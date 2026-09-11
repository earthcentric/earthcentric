"use server";

import crypto from "crypto";
import db from "@/lib/db";
import { sendBuyerRegistrationOTPEmail } from "@/lib/email";

const OTP_EXPIRY_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

// In-memory fallback tracking for rate limiting & lockout across environments
interface LockoutInfo {
  attempts: number;
  blockedUntil: number | null;
}
const inMemoryLockouts = new Map<string, LockoutInfo>();

function hashOtp(otp: string): string {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

function generateOtp(): string {
  // 6-digit numeric OTP
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Generates a 6-digit OTP, stores it (hashed) in OtpVerification, and sends it to the user's email.
 * If an unexpired, unverified record exists, it is overwritten (allows resend).
 * Respects 15-minute lockout if the account exceeded failed attempts.
 */
export async function sendBuyerOtp(
  email: string,
  name: string
): Promise<{ success: boolean; emailFailed?: boolean; error?: string; otp?: string }> {
  try {
    const normalizedEmail = email.toLowerCase().trim();

    // Check in-memory lockout
    const memLockout = inMemoryLockouts.get(normalizedEmail);
    if (memLockout && memLockout.blockedUntil && Date.now() < memLockout.blockedUntil) {
      const remainingMins = Math.ceil((memLockout.blockedUntil - Date.now()) / (60 * 1000));
      return {
        success: false,
        error: `Too many failed verification attempts. Account is locked. Please try again in ${remainingMins} minute(s).`,
      };
    }

    // Check if email is already registered as a user
    const existingUser = await db.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      return {
        success: false,
        error: "An account with this email already exists. Please sign in.",
      };
    }

    // Check if an existing OTP is currently locked out in DB
    const existingOtp = await db.otpVerification.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingOtp && (existingOtp as any).blockedUntil && new Date() < (existingOtp as any).blockedUntil) {
      const remainingMins = Math.ceil(((existingOtp as any).blockedUntil.getTime() - Date.now()) / (60 * 1000));
      return {
        success: false,
        error: `Too many failed verification attempts. Account is locked. Please try again in ${remainingMins} minute(s).`,
      };
    }

    const otp = generateOtp();
    const otpHash = hashOtp(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Send OTP email — log plaintext OTP to terminal console
    console.log("\n╔══════════════════════════════════════╗");
    console.log("║        🔐  DEV MODE OTP CODE          ║");
    console.log(`║   Email : ${normalizedEmail.padEnd(26)}║`);
    console.log(`║   OTP   : ${otp}                        ║`);
    console.log("╚══════════════════════════════════════╝\n");

    // Always save the new OTP to DB so verification works in dev/test mode even if email delivery fails
    try {
      await db.otpVerification.upsert({
        where: { email: normalizedEmail },
        update: {
          otpHash,
          expiresAt,
          verified: false,
          attempts: 0,
          blockedUntil: null,
          createdAt: new Date(),
        } as any,
        create: {
          email: normalizedEmail,
          otpHash,
          expiresAt,
          verified: false,
          attempts: 0,
          blockedUntil: null,
        } as any,
      });
    } catch {
      await db.otpVerification.upsert({
        where: { email: normalizedEmail },
        update: { otpHash, expiresAt, verified: false, createdAt: new Date() },
        create: { email: normalizedEmail, otpHash, expiresAt, verified: false },
      });
    }

    inMemoryLockouts.delete(normalizedEmail);

    const emailResult = await sendBuyerRegistrationOTPEmail(
      normalizedEmail,
      name,
      otp
    );

    const isMockOrFailed = !emailResult.success || (emailResult as any).isMock;

    return {
      success: true,
      emailFailed: isMockOrFailed,
      otp: process.env.NODE_ENV === "development" ? otp : undefined,
      error: isMockOrFailed
        ? `SMTP delivery failed (${(emailResult as any).error || "BadCredentials"}). Dev Mode: Exposing OTP directly.`
        : undefined
    };
  } catch (error) {
    console.error("sendBuyerOtp failed:", error);
    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
    };
  }
}

/**
 * Verifies the OTP entered by the user.
 * Marks the record as verified so signupUser can confirm email ownership.
 * Enforces rate limiting: 5 failed attempts locks the email for 15 minutes.
 */
export async function verifyBuyerOtp(
  email: string,
  otp: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const otpHash = hashOtp(otp);
    const now = new Date();

    // 1. Check in-memory lockout first
    const memLockout = inMemoryLockouts.get(normalizedEmail);
    if (memLockout && memLockout.blockedUntil && Date.now() < memLockout.blockedUntil) {
      const remainingMins = Math.ceil((memLockout.blockedUntil - Date.now()) / (60 * 1000));
      return {
        success: false,
        error: `Too many failed attempts. Account is temporarily locked. Please try again in ${remainingMins} minute(s).`,
      };
    }

    const record = await db.otpVerification.findUnique({
      where: { email: normalizedEmail },
    });

    if (!record) {
      return {
        success: false,
        error: "No OTP found for this email. Please request a new one.",
      };
    }

    // 2. Check DB lockout
    if ((record as any).blockedUntil && now < (record as any).blockedUntil) {
      const remainingMins = Math.ceil(((record as any).blockedUntil.getTime() - Date.now()) / (60 * 1000));
      return {
        success: false,
        error: `Too many failed attempts. Account is temporarily locked. Please try again in ${remainingMins} minute(s).`,
      };
    }

    if (record.verified) {
      // Already verified — allow user to proceed (idempotent)
      return { success: true };
    }

    if (now > record.expiresAt) {
      return {
        success: false,
        error: "OTP has expired. Please request a new one.",
      };
    }

    const currentAttempts = ((record as any).attempts || 0) + 1;
    const memAttempts = (memLockout?.attempts || 0) + 1;
    const attemptsCount = Math.max(currentAttempts, memAttempts);

    // 3. Incorrect OTP handling with lockout
    if (record.otpHash !== otpHash) {
      if (attemptsCount >= MAX_OTP_ATTEMPTS) {
        const lockoutTime = Date.now() + LOCKOUT_MINUTES * 60 * 1000;
        const blockedUntil = new Date(lockoutTime);

        inMemoryLockouts.set(normalizedEmail, {
          attempts: attemptsCount,
          blockedUntil: lockoutTime,
        });

        try {
          await db.otpVerification.update({
            where: { email: normalizedEmail },
            data: {
              attempts: attemptsCount,
              blockedUntil,
            } as any,
          });
        } catch (e) {
          console.warn("Could not persist lockout to DB:", e);
        }

        return {
          success: false,
          error: `Too many failed attempts (${MAX_OTP_ATTEMPTS}/${MAX_OTP_ATTEMPTS}). Account is locked for ${LOCKOUT_MINUTES} minutes.`,
        };
      } else {
        inMemoryLockouts.set(normalizedEmail, {
          attempts: attemptsCount,
          blockedUntil: null,
        });

        try {
          await db.otpVerification.update({
            where: { email: normalizedEmail },
            data: {
              attempts: attemptsCount,
            } as any,
          });
        } catch (e) {
          console.warn("Could not persist attempts to DB:", e);
        }

        const remainingAttempts = MAX_OTP_ATTEMPTS - attemptsCount;
        return {
          success: false,
          error: `Incorrect OTP. You have ${remainingAttempts} attempt${remainingAttempts === 1 ? "" : "s"} remaining.`,
        };
      }
    }

    // 4. Successful verification
    inMemoryLockouts.delete(normalizedEmail);
    try {
      await db.otpVerification.update({
        where: { email: normalizedEmail },
        data: {
          verified: true,
          attempts: 0,
          blockedUntil: null,
        } as any,
      });
    } catch {
      await db.otpVerification.update({
        where: { email: normalizedEmail },
        data: { verified: true },
      });
    }

    return { success: true };
  } catch (error) {
    console.error("verifyBuyerOtp failed:", error);
    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
    };
  }
}
