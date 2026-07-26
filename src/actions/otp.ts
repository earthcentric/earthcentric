"use server";

import crypto from "crypto";
import db from "@/lib/db";
import { sendBuyerRegistrationOTPEmail } from "@/lib/email";

const OTP_EXPIRY_MINUTES = 10;

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
 */
export async function sendBuyerOtp(
  email: string,
  name: string
): Promise<{ success: boolean; emailFailed?: boolean; error?: string; otp?: string }> {
  try {
    const normalizedEmail = email.toLowerCase().trim();

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

    // Check if a valid, unexpired OTP already exists in DB
    const existingOtp = await db.otpVerification.findUnique({
      where: { email: normalizedEmail },
    });
    const hasValidExisting =
      existingOtp &&
      !existingOtp.verified &&
      existingOtp.expiresAt > new Date();

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
    await db.otpVerification.upsert({
      where: { email: normalizedEmail },
      update: { otpHash, expiresAt, verified: false, createdAt: new Date() },
      create: { email: normalizedEmail, otpHash, expiresAt, verified: false },
    });

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
 */
export async function verifyBuyerOtp(
  email: string,
  otp: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const otpHash = hashOtp(otp);

    const record = await db.otpVerification.findUnique({
      where: { email: normalizedEmail },
    });

    if (!record) {
      return {
        success: false,
        error: "No OTP found for this email. Please request a new one.",
      };
    }

    if (record.verified) {
      // Already verified — allow user to proceed (idempotent)
      return { success: true };
    }

    if (new Date() > record.expiresAt) {
      return {
        success: false,
        error: "OTP has expired. Please request a new one.",
      };
    }

    if (record.otpHash !== otpHash) {
      return {
        success: false,
        error: "Incorrect OTP. Please try again.",
      };
    }

    // Mark as verified
    await db.otpVerification.update({
      where: { email: normalizedEmail },
      data: { verified: true },
    });

    return { success: true };
  } catch (error) {
    console.error("verifyBuyerOtp failed:", error);
    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
    };
  }
}
