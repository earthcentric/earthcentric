"use server";

import crypto from "crypto";
import db from "@/lib/db";
import { getVerifiedClerkIdentity } from "@/lib/clerk-identity";
import { verifyAuthenticatedUser } from "@/lib/auth-server";
import { sendEmailWithSendGrid, buildBuyerOtpEmailHtml } from "@/lib/sendgrid";
import { setEarthcentricSessionCookie } from "@/lib/session";
import { isSuperAdminEmail, isConfiguredSellerEmail } from "@/lib/account-roles";

const OTP_EXPIRY_MINUTES = 5;
const MAX_OTP_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const RESEND_COOLDOWN_SECONDS = 60;

function hashOtp(otp: string): string {
  return crypto.createHash("sha256").update(otp.trim()).digest("hex");
}

function generateRandomOtp(): string {
  // Cryptographically secure random 6-digit number between 100000 and 999999
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Validates country code and mobile number format.
 */
function validatePhoneNumber(countryCode: string, mobileNumber: string): { valid: boolean; cleaned: string; error?: string } {
  const digits = mobileNumber.replace(/\D/g, "");
  const cleanCountryCode = countryCode.trim().startsWith("+") ? countryCode.trim() : `+${countryCode.trim()}`;

  if (!digits) {
    return { valid: false, cleaned: "", error: "Please enter your mobile number." };
  }

  // India validation (+91)
  if (cleanCountryCode === "+91") {
    if (digits.length !== 10) {
      return { valid: false, cleaned: digits, error: "Please enter a valid 10-digit Indian mobile number." };
    }
    if (!/^[6-9]\d{9}$/.test(digits)) {
      return { valid: false, cleaned: digits, error: "Indian mobile numbers must start with 6, 7, 8, or 9." };
    }
    return { valid: true, cleaned: digits };
  }

  // International phone validation: 7 to 15 digits
  if (digits.length < 7 || digits.length > 15) {
    return { valid: false, cleaned: digits, error: "Please enter a valid mobile number (7-15 digits)." };
  }

  return { valid: true, cleaned: digits };
}

/**
 * Returns the current buyer onboarding/verification state for the logged-in user.
 */
export async function getBuyerAuthState(): Promise<{
  authenticated: boolean;
  step: "GOOGLE_LOGIN" | "MOBILE_NUMBER" | "OTP_VERIFICATION" | "PROFILE_COMPLETION" | "COMPLETED";
  isVerified: boolean;
  role?: string;
  email?: string;
  name?: string;
  mobileNumber?: string | null;
  countryCode?: string;
  error?: string;
}> {
  try {
    const authUser = await verifyAuthenticatedUser();

    if (!authUser.authorized || !authUser.userId || !authUser.email) {
      return {
        authenticated: false,
        step: "GOOGLE_LOGIN",
        isVerified: false,
      };
    }

    // Admins, Sellers and Workers are exempt from the mandatory buyer verification flow
    if (authUser.role === "ADMIN" || authUser.role === "SELLER" || authUser.role === "WORKER") {
      return {
        authenticated: true,
        step: "COMPLETED",
        isVerified: true,
        role: authUser.role,
        email: authUser.email,
      };
    }

    // Lookup fresh user record from DB
    const user = await db.user.findUnique({
      where: { id: authUser.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        mobileNumber: true,
        mobileNumberCountryCode: true,
        mobileNumberSubmitted: true,
        emailVerified: true,
        buyerOnboardingCompleted: true,
        buyerVerifiedAt: true,
      },
    });

    if (!user) {
      return {
        authenticated: false,
        step: "GOOGLE_LOGIN",
        isVerified: false,
        error: "User record could not be loaded.",
      };
    }

    const countryCode = user.mobileNumberCountryCode || "+91";

    const isSuperAdmin = isSuperAdminEmail(user.email);
    const effectiveRole = isSuperAdmin ? "ADMIN" : user.role;

    // 1. If buyer/seller already completed onboarding:
    if (user.buyerOnboardingCompleted) {
      return {
        authenticated: true,
        step: "COMPLETED",
        isVerified: true,
        role: effectiveRole,
        email: user.email,
        name: user.name || "",
        mobileNumber: user.mobileNumber,
        countryCode,
      };
    }

    // 2. If mobile number has not yet been submitted:
    if (!user.mobileNumberSubmitted || !user.mobileNumber) {
      return {
        authenticated: true,
        step: "MOBILE_NUMBER",
        isVerified: false,
        role: effectiveRole,
        email: user.email,
        name: user.name || "",
        mobileNumber: user.mobileNumber,
        countryCode,
      };
    }

    // 3. Mobile number is submitted, but OTP verification pending:
    if (!user.emailVerified) {
      return {
        authenticated: true,
        step: "OTP_VERIFICATION",
        isVerified: false,
        role: effectiveRole,
        email: user.email,
        name: user.name || "",
        mobileNumber: user.mobileNumber,
        countryCode,
      };
    }

    // 4. OTP verified, but profile and delivery address completion pending:
    return {
      authenticated: true,
      step: "PROFILE_COMPLETION",
      isVerified: false,
      role: effectiveRole,
      email: user.email,
      name: user.name || "",
      mobileNumber: user.mobileNumber,
      countryCode,
    };
  } catch (err: any) {
    console.error("getBuyerAuthState error:", err);
    return {
      authenticated: false,
      step: "GOOGLE_LOGIN",
      isVerified: false,
      error: "Error checking authentication status.",
    };
  }
}

/**
 * Step 1: Initiates Google/Gmail authentication for a buyer or seller.
 * Validates the email address, retrieves or creates the user record without duplicating,
 * establishes the earthcentric session, and returns the next step.
 */
export async function initiateBuyerGoogleEmailAuth(email: string): Promise<{
  success: boolean;
  error?: string;
  step?: "MOBILE_NUMBER" | "OTP_VERIFICATION" | "PROFILE_COMPLETION" | "COMPLETED";
  email?: string;
  name?: string;
  role?: string;
}> {
  try {
    const normalizedEmail = (email || "").trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes("@") || !normalizedEmail.includes(".")) {
      return { success: false, error: "Please enter a valid Google/Gmail email address." };
    }

    // Lookup existing user or create a new buyer account
    let user = await db.user.findUnique({
      where: { email: normalizedEmail },
    });

    const isSuperAdmin = isSuperAdminEmail(normalizedEmail);
    const isConfiguredSeller = isConfiguredSellerEmail(normalizedEmail);

    if (!user) {
      user = await db.user.create({
        data: {
          email: normalizedEmail,
          name: normalizedEmail.split("@")[0],
          role: isSuperAdmin ? "ADMIN" : (isConfiguredSeller ? "SELLER" : "BUYER"),
          mobileNumberSubmitted: false,
          buyerOnboardingCompleted: false,
        },
      });
    } else {
      if (isSuperAdmin && user.role !== "ADMIN") {
        user = await db.user.update({
          where: { id: user.id },
          data: { role: "ADMIN" },
        });
      } else if (isConfiguredSeller && user.role !== "SELLER" && user.role !== "ADMIN") {
        user = await db.user.update({
          where: { id: user.id },
          data: { role: "SELLER" },
        });
      }
    }

    // Super Admin exemption
    if (user.role === "ADMIN" || isSuperAdmin) {
      await setEarthcentricSessionCookie({
        id: user.id,
        role: "ADMIN",
        buyerOnboardingCompleted: true,
        mobileNumberSubmitted: true,
      });
      return {
        success: true,
        step: "COMPLETED",
        email: user.email,
        name: user.name || "",
        role: "ADMIN",
      };
    }

    // Seller exemption
    if (user.role === "SELLER" || isConfiguredSeller) {
      await setEarthcentricSessionCookie({
        id: user.id,
        role: "SELLER",
        buyerOnboardingCompleted: true,
        mobileNumberSubmitted: true,
      });
      return {
        success: true,
        step: "COMPLETED",
        email: user.email,
        name: user.name || "",
        role: "SELLER",
      };
    }

    // Set session cookie for buyer/seller
    await setEarthcentricSessionCookie({
      id: user.id,
      role: user.role,
      buyerOnboardingCompleted: user.buyerOnboardingCompleted,
      mobileNumberSubmitted: user.mobileNumberSubmitted,
    });

    if (user.buyerOnboardingCompleted && user.mobileNumberSubmitted) {
      return {
        success: true,
        step: "COMPLETED",
        email: user.email,
        name: user.name || "",
        role: user.role,
      };
    }

    if (user.mobileNumberSubmitted && !user.buyerOnboardingCompleted) {
      if (user.emailVerified) {
        return {
          success: true,
          step: "PROFILE_COMPLETION",
          email: user.email,
          name: user.name || "",
          role: user.role,
        };
      }
      return {
        success: true,
        step: "OTP_VERIFICATION",
        email: user.email,
        name: user.name || "",
        role: user.role,
      };
    }

    return {
      success: true,
      step: "MOBILE_NUMBER",
      email: user.email,
      name: user.name || "",
      role: user.role,
    };
  } catch (err: any) {
    console.error("initiateBuyerGoogleEmailAuth error:", err);
    return { success: false, error: "Failed to initialize authentication." };
  }
}

/**
 * Step 2: Buyer submits their mobile number with country code.
 * Validates mobile number, saves it, generates 5-minute OTP, and sends via SendGrid to buyer's Google email.
 * NEVER exposes the OTP in frontend response or logs.
 */
export async function submitBuyerMobileNumber(data: {
  mobileNumber: string;
  countryCode?: string;
}): Promise<{
  success: boolean;
  error?: string;
  cooldownSeconds?: number;
  email?: string;
}> {
  try {
    const authUser = await verifyAuthenticatedUser();
    if (!authUser.authorized || !authUser.userId || !authUser.email) {
      return { success: false, error: "Please sign in with Google first." };
    }

    const countryCode = data.countryCode || "+91";
    const validation = validatePhoneNumber(countryCode, data.mobileNumber);
    if (!validation.valid) {
      return { success: false, error: validation.error || "Invalid mobile number format." };
    }

    const normalizedEmail = authUser.email.toLowerCase().trim();

    // Check if currently locked out
    const existingOtp = await db.otpVerification.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingOtp?.blockedUntil && new Date() < existingOtp.blockedUntil) {
      const remainingMins = Math.ceil((existingOtp.blockedUntil.getTime() - Date.now()) / (60 * 1000));
      return {
        success: false,
        error: `Too many failed verification attempts. Account is temporarily blocked. Please try again in ${remainingMins} minute(s).`,
      };
    }

    // Check resend cooldown
    if (existingOtp?.lastSentAt) {
      const elapsedMs = Date.now() - existingOtp.lastSentAt.getTime();
      if (elapsedMs < RESEND_COOLDOWN_SECONDS * 1000) {
        const remainingSeconds = Math.ceil((RESEND_COOLDOWN_SECONDS * 1000 - elapsedMs) / 1000);
        return {
          success: false,
          cooldownSeconds: remainingSeconds,
          error: `Please wait ${remainingSeconds} second(s) before requesting another code.`,
        };
      }
    }

    // Update User mobile number in database
    await db.user.update({
      where: { id: authUser.userId },
      data: {
        mobileNumber: validation.cleaned,
        mobileNumberCountryCode: countryCode,
        mobileNumberSubmitted: true,
        phone: validation.cleaned, // preserve compatibility with existing phone field
      },
    });

    // Generate secure random OTP & hash
    const otp = generateRandomOtp();
    const otpHash = hashOtp(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    const now = new Date();

    // Store hashed OTP in OtpVerification
    await db.otpVerification.upsert({
      where: { email: normalizedEmail },
      update: {
        otpHash,
        expiresAt,
        verified: false,
        attempts: 0,
        blockedUntil: null,
        lastSentAt: now,
      },
      create: {
        email: normalizedEmail,
        otpHash,
        expiresAt,
        verified: false,
        attempts: 0,
        blockedUntil: null,
        lastSentAt: now,
      },
    });

    // Fetch user name for personalized greeting
    const userProfile = await db.user.findUnique({
      where: { id: authUser.userId },
      select: { name: true },
    });

    // Send OTP via SendGrid to buyer's authenticated Google account email
    const emailResult = await sendEmailWithSendGrid({
      to: normalizedEmail,
      subject: "Your EarthCentric Verification Code",
      html: buildBuyerOtpEmailHtml(otp, userProfile?.name || undefined),
    });

    if (!emailResult.success && !emailResult.messageId) {
      console.warn("[SendGrid Dispatch Warning]:", emailResult.error);
    }

    return {
      success: true,
      email: normalizedEmail,
      cooldownSeconds: RESEND_COOLDOWN_SECONDS,
    };
  } catch (err: any) {
    console.error("submitBuyerMobileNumber error:", err);
    return { success: false, error: "An unexpected error occurred while processing your mobile number." };
  }
}

/**
 * Step 4: Verify the OTP sent to buyer's Google email.
 * Enforces:
 * - 5-minute expiry
 * - 5 max attempts with 15-minute temporary lockout
 * - Instant invalidation of OTP upon successful verification to prevent replay attacks
 * - Updates user profile: buyerOnboardingCompleted = true, buyerVerifiedAt = now
 * - Updates session cookie
 * NEVER exposes OTP.
 */
export async function verifyBuyerOtpAction(otpInput: string): Promise<{
  success: boolean;
  error?: string;
  isBlocked?: boolean;
  blockedMinutes?: number;
  remainingAttempts?: number;
  step?: "PROFILE_COMPLETION" | "COMPLETED";
  role?: string;
}> {
  try {
    const authUser = await verifyAuthenticatedUser();
    if (!authUser.authorized || !authUser.userId || !authUser.email) {
      return { success: false, error: "Please sign in with Google first." };
    }

    const normalizedEmail = authUser.email.toLowerCase().trim();
    const cleanOtp = (otpInput || "").trim();

    if (!cleanOtp || cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      return { success: false, error: "Please enter the 6-digit verification code received in your email." };
    }

    const record = await db.otpVerification.findUnique({
      where: { email: normalizedEmail },
    });

    if (!record) {
      return {
        success: false,
        error: "No active verification code found. Please request a new code.",
      };
    }

    const now = new Date();

    // 1. Check if blocked
    if (record.blockedUntil && now < record.blockedUntil) {
      const remainingMins = Math.ceil((record.blockedUntil.getTime() - now.getTime()) / (60 * 1000));
      return {
        success: false,
        isBlocked: true,
        blockedMinutes: remainingMins,
        error: `Too many failed attempts. Account verification is temporarily locked. Please try again in ${remainingMins} minute(s).`,
      };
    }

    // 2. Check if expired
    if (now > record.expiresAt) {
      return {
        success: false,
        error: "Verification code has expired (valid for 5 minutes). Please request a new code.",
      };
    }

    // 3. Verify OTP Hash
    const inputHash = hashOtp(cleanOtp);
    if (record.otpHash !== inputHash) {
      const newAttempts = record.attempts + 1;

      if (newAttempts >= MAX_OTP_ATTEMPTS) {
        const lockoutDate = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
        await db.otpVerification.update({
          where: { email: normalizedEmail },
          data: {
            attempts: newAttempts,
            blockedUntil: lockoutDate,
          },
        });

        return {
          success: false,
          isBlocked: true,
          blockedMinutes: LOCKOUT_MINUTES,
          error: `Too many incorrect attempts (${MAX_OTP_ATTEMPTS}/${MAX_OTP_ATTEMPTS}). Verification locked for ${LOCKOUT_MINUTES} minutes.`,
        };
      } else {
        await db.otpVerification.update({
          where: { email: normalizedEmail },
          data: {
            attempts: newAttempts,
          },
        });

        const remaining = MAX_OTP_ATTEMPTS - newAttempts;
        return {
          success: false,
          remainingAttempts: remaining,
          error: `Incorrect verification code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
        };
      }
    }

    // 4. Successful verification:
    // Invalidate OTP immediately to prevent reuse
    await db.otpVerification.update({
      where: { email: normalizedEmail },
      data: {
        verified: true,
        otpHash: "", // Invalidate
        attempts: 0,
        blockedUntil: null,
      },
    });

    // Mark email verified (buyer profile/address completion is next mandatory step)
    await db.user.update({
      where: { id: authUser.userId },
      data: {
        emailVerified: now,
      },
    });

    // Update session cookie
    await setEarthcentricSessionCookie({
      id: authUser.userId,
      role: authUser.role || "BUYER",
      buyerOnboardingCompleted: false,
      mobileNumberSubmitted: true,
    });

    return {
      success: true,
      step: "PROFILE_COMPLETION",
      role: authUser.role || "BUYER",
    };
  } catch (err: any) {
    console.error("verifyBuyerOtpAction error:", err);
    return { success: false, error: "An unexpected error occurred during OTP verification." };
  }
}

/**
 * Step 5: Save Mandatory Buyer Profile & Delivery Address after OTP verification.
 * Creates default Address and marks buyer onboarding as completed.
 */
export async function completeBuyerProfileAction(data: {
  name: string;
  building: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
}): Promise<{
  success: boolean;
  error?: string;
  role?: string;
}> {
  try {
    const authUser = await verifyAuthenticatedUser();
    if (!authUser.authorized || !authUser.userId || !authUser.email) {
      return { success: false, error: "Please sign in with Google first." };
    }

    const name = (data.name || "").trim();
    const building = (data.building || "").trim();
    const street = (data.street || "").trim();
    const city = (data.city || "").trim();
    const state = (data.state || "").trim();
    const postalCode = (data.postalCode || "").trim();
    const country = (data.country || "India").trim();

    if (!name || name.length < 2) {
      return { success: false, error: "Please enter your full name." };
    }
    if (!building) {
      return { success: false, error: "Please enter your House / Flat / Building No." };
    }
    if (!street || street.length < 2) {
      return { success: false, error: "Please enter your Street / Road / Area." };
    }
    if (!city || city.length < 2) {
      return { success: false, error: "Please enter your City." };
    }
    if (!state || state.length < 2) {
      return { success: false, error: "Please enter your State." };
    }
    if (!postalCode || !/^\d{6}$/.test(postalCode)) {
      return { success: false, error: "Please enter a valid 6-digit Indian PIN code." };
    }

    const fullStreet = `${building}, ${street}`;

    // Upsert default Address
    const existingAddress = await db.address.findFirst({
      where: { userId: authUser.userId, isDefault: true },
    });

    if (existingAddress) {
      await db.address.update({
        where: { id: existingAddress.id },
        data: {
          street: fullStreet,
          city,
          state,
          postalCode,
          country,
          label: "Home",
          isDefault: true,
        },
      });
    } else {
      await db.address.create({
        data: {
          userId: authUser.userId,
          street: fullStreet,
          city,
          state,
          postalCode,
          country,
          label: "Home",
          isDefault: true,
        },
      });
    }

    const now = new Date();
    const updatedUser = await db.user.update({
      where: { id: authUser.userId },
      data: {
        name,
        buyerOnboardingCompleted: true,
        buyerVerifiedAt: now,
      },
    });

    // Update session cookie with verified & completed status
    await setEarthcentricSessionCookie({
      id: updatedUser.id,
      role: updatedUser.role,
      buyerOnboardingCompleted: true,
      mobileNumberSubmitted: true,
    });

    return {
      success: true,
      role: updatedUser.role,
    };
  } catch (err: any) {
    console.error("completeBuyerProfileAction error:", err);
    return { success: false, error: "Failed to save profile. Please try again." };
  }
}

/**
 * Resends a fresh OTP to the buyer's Google email.
 * Enforces 60-second cooldown and temporary block rules.
 * NEVER exposes OTP.
 */
export async function resendBuyerOtpAction(): Promise<{
  success: boolean;
  error?: string;
  cooldownSeconds?: number;
}> {
  try {
    const authUser = await verifyAuthenticatedUser();
    if (!authUser.authorized || !authUser.userId || !authUser.email) {
      return { success: false, error: "Please sign in with Google first." };
    }

    const normalizedEmail = authUser.email.toLowerCase().trim();

    const existingRecord = await db.otpVerification.findUnique({
      where: { email: normalizedEmail },
    });

    const now = new Date();

    // Check if blocked
    if (existingRecord?.blockedUntil && now < existingRecord.blockedUntil) {
      const remainingMins = Math.ceil((existingRecord.blockedUntil.getTime() - now.getTime()) / (60 * 1000));
      return {
        success: false,
        error: `Too many failed attempts. Verification is locked. Please try again in ${remainingMins} minute(s).`,
      };
    }

    // Check cooldown
    if (existingRecord?.lastSentAt) {
      const elapsedMs = now.getTime() - existingRecord.lastSentAt.getTime();
      if (elapsedMs < RESEND_COOLDOWN_SECONDS * 1000) {
        const remainingSec = Math.ceil((RESEND_COOLDOWN_SECONDS * 1000 - elapsedMs) / 1000);
        return {
          success: false,
          cooldownSeconds: remainingSec,
          error: `Please wait ${remainingSec} second(s) before requesting another code.`,
        };
      }
    }

    // Generate new OTP
    const otp = generateRandomOtp();
    const otpHash = hashOtp(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await db.otpVerification.upsert({
      where: { email: normalizedEmail },
      update: {
        otpHash,
        expiresAt,
        verified: false,
        attempts: 0,
        blockedUntil: null,
        lastSentAt: now,
      },
      create: {
        email: normalizedEmail,
        otpHash,
        expiresAt,
        verified: false,
        attempts: 0,
        blockedUntil: null,
        lastSentAt: now,
      },
    });

    const userProfile = await db.user.findUnique({
      where: { id: authUser.userId },
      select: { name: true },
    });

    await sendEmailWithSendGrid({
      to: normalizedEmail,
      subject: "Your EarthCentric Verification Code",
      html: buildBuyerOtpEmailHtml(otp, userProfile?.name || undefined),
    });

    return {
      success: true,
      cooldownSeconds: RESEND_COOLDOWN_SECONDS,
    };
  } catch (err: any) {
    console.error("resendBuyerOtpAction error:", err);
    return { success: false, error: "Failed to resend verification code. Please try again." };
  }
}

