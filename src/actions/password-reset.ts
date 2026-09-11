"use server";

import { sendForgotPasswordOTPEmail } from "@/lib/email";
import db from "@/lib/db";
import crypto from "crypto";

// ─── In-memory OTP store (for both mock and DB modes) ──────────────
// In production, you'd use Redis or a database table for OTPs.
// Using a server-side Map here for simplicity.
const otpStore = new Map<
  string,
  {
    otp: string;
    expiresAt: number;
    attempts: number;
    verifyAttempts?: number;
    blockedUntil?: number;
  }
>();

function generateOTP(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// ─── Request Password Reset (send OTP) ────────────────────────────
export async function requestPasswordReset(email: string): Promise<{
  success: boolean;
  error?: string;
  isMock?: boolean;
  otp?: string;
}> {
  if (!email || !email.includes("@")) {
    return { success: false, error: "Please enter a valid email address." };
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Check lockout
  const existing = otpStore.get(normalizedEmail);
  if (existing && existing.blockedUntil && Date.now() < existing.blockedUntil) {
    const remainingMins = Math.ceil((existing.blockedUntil - Date.now()) / (60 * 1000));
    return {
      success: false,
      error: `Too many failed attempts. Account is locked. Please try again in ${remainingMins} minute(s).`,
    };
  }

  // Check if email exists in database (optional — can skip for privacy)
  try {
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("mock")) {
      const user = await db.user.findUnique({
        where: { email: normalizedEmail },
      });
      if (!user) {
        // Don't reveal if email exists (security best practice)
        // Still return success to prevent email enumeration
        console.log(`[OTP] Password reset requested for non-existent email: ${normalizedEmail}`);
        return { success: true };
      }
    }
  } catch (e) {
    console.warn("DB lookup for OTP email failed, proceeding anyway:", e);
  }

  // Rate limiting: max 3 OTPs per email per 10 minutes
  if (existing && existing.attempts >= 3 && existing.expiresAt > Date.now()) {
    return {
      success: false,
      error: "Too many requests. Please wait before requesting another code.",
    };
  }

  // Generate OTP
  const otp = generateOTP();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  otpStore.set(normalizedEmail, {
    otp,
    expiresAt,
    attempts: (existing?.attempts || 0) + 1,
    verifyAttempts: 0,
    blockedUntil: undefined,
  });

  // Send OTP email
  const result = await sendForgotPasswordOTPEmail(normalizedEmail, otp);

  const isMockOrFailed = !result.success || (result as any).isMock;

  console.log(`[OTP] Code sent to ${normalizedEmail}: ${otp}`);
  return {
    success: true,
    isMock: isMockOrFailed,
    otp: process.env.NODE_ENV === "development" ? otp : undefined,
  };
}

// ─── Verify OTP ────────────────────────────────────────────────────
export async function verifyPasswordResetOTP(
  email: string,
  otpCode: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!email || !otpCode) {
    return { success: false, error: "Email and OTP code are required." };
  }

  const normalizedEmail = email.toLowerCase().trim();
  const stored = otpStore.get(normalizedEmail);

  if (!stored) {
    return { success: false, error: "No verification code found. Please request a new one." };
  }

  // Check lockout
  if (stored.blockedUntil && Date.now() < stored.blockedUntil) {
    const remainingMins = Math.ceil((stored.blockedUntil - Date.now()) / (60 * 1000));
    return {
      success: false,
      error: `Too many failed attempts. Account is locked. Please try again in ${remainingMins} minute(s).`,
    };
  }

  if (Date.now() > stored.expiresAt) {
    otpStore.delete(normalizedEmail);
    return { success: false, error: "Verification code expired. Please request a new one." };
  }

  if (stored.otp !== otpCode) {
    const failedCount = (stored.verifyAttempts || 0) + 1;
    if (failedCount >= 5) {
      stored.blockedUntil = Date.now() + 15 * 60 * 1000;
      stored.verifyAttempts = failedCount;
      return {
        success: false,
        error: "Too many failed attempts (5/5). Account locked for 15 minutes.",
      };
    }
    stored.verifyAttempts = failedCount;
    const remaining = 5 - failedCount;
    return {
      success: false,
      error: `Invalid verification code. You have ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
    };
  }

  // OTP verified successfully — clean up
  otpStore.delete(normalizedEmail);

  console.log(`[OTP] Verified successfully for ${normalizedEmail}`);
  return { success: true };
}

// ─── Resend OTP ────────────────────────────────────────────────────
export async function resendPasswordResetOTP(email: string): Promise<{
  success: boolean;
  error?: string;
  isMock?: boolean;
  otp?: string;
}> {
  return requestPasswordReset(email);
}

// ─── Reset Password ────────────────────────────────────────────────
export async function resetPassword(
  email: string,
  newPassword: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!email || !newPassword) {
    return { success: false, error: "Email and new password are required." };
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("mock")) {
      const user = await db.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (!user) {
        return { success: false, error: "User not found." };
      }

      const hashedPassword = crypto.createHash("sha256").update(newPassword).digest("hex");
      await db.user.update({
        where: { email: normalizedEmail },
        data: { password: hashedPassword }
      });
    }

    console.log(`[Password Reset] Password reset successfully for ${normalizedEmail}`);
    return { success: true };
  } catch (e: any) {
    console.error("Password reset failed:", e);
    return { success: false, error: "Failed to reset password. Please try again." };
  }
}
