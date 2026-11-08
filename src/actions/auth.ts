"use server";

import db from "@/lib/db";
import { sendWelcomeEmail } from "@/lib/email";
import { uploadImage, deleteImage, getPublicIdFromDb } from "@/lib/cloudinary";
import { isConfiguredSellerEmail, isSuperAdminEmail } from "@/lib/account-roles";
import { getVerifiedClerkIdentity } from "@/lib/clerk-identity";
import crypto from "crypto";
import { cookies } from "next/headers";
import { setEarthcentricSessionCookie } from "@/lib/session";
import { verifyAdminAuth, verifyAuthenticatedUser } from "@/lib/auth-server";

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export async function loginUser(email: string, password?: string): Promise<{ success: boolean; user?: any; error?: string }> {
  try {
    if (!password) {
      return { success: false, error: "Password is required" };
    }

    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { seller: true }
    });

    if (!user) {
      return { success: false, error: "Invalid email or password" };
    }

    if (user.password) {
      const hashedInput = hashPassword(password);
      if (user.password !== hashedInput) {
        return { success: false, error: "Invalid email or password" };
      }
    } else {
      return { success: false, error: "Credentials login not set for this account" };
    }


    
    const finalUser = {
      id: user.id,
      name: user.name || "",
      email: user.email,
      phone: user.phone || null,
      role: user.role,
      sellerStatus: user.seller?.verificationStatus,
      sellerId: user.seller?.id,
      badges: user.seller?.badges || [],
      isNewUser: false,
    };
    
    await setEarthcentricSessionCookie({
      id: user.id,
      role: user.role,
      sellerStatus: user.seller?.verificationStatus,
    });

    return {
      success: true,
      user: finalUser
    };
  } catch (error) {
    console.error("Login server action failed:", error);
    return { success: false, error: "An unexpected error occurred during login." };
  }
}

export async function signupUser(
  name: string,
  email: string,
  role: string,
  password?: string,
  phone?: string
): Promise<{ success: boolean; user?: any; error?: string }> {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    if (role !== "BUYER" && role !== "SELLER") {
      return { success: false, error: "Choose a valid account type." };
    }

    // --- Guard: For BUYER registrations, ensure email was OTP-verified ---
    if (role === "BUYER") {
      const otpRecord = await db.otpVerification.findUnique({
        where: { email: normalizedEmail },
      });
      if (!otpRecord || !otpRecord.verified) {
        return {
          success: false,
          error: "Email not verified. Please complete OTP verification first.",
        };
      }
    }

    const existing = await db.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (existing) {
      return { success: false, error: "User with this email already exists" };
    }

    const userId = `u-${Math.random().toString(36).substring(2, 10)}`;
    const hashedPassword = password ? hashPassword(password) : null;

    const user = await db.user.create({
      data: {
        id: userId,
        name,
        email: normalizedEmail,
        password: hashedPassword,
        phone: phone || null,
        role,
        // Mark emailVerified since we confirmed via OTP
        emailVerified: role === "BUYER" ? new Date() : null,
      }
    });

    // Clean up OtpVerification row after successful account creation
    if (role === "BUYER") {
      await db.otpVerification.delete({ where: { email: normalizedEmail } }).catch(() => {
        // Non-fatal — ignore if already deleted
      });
    }

    // Create Welcome Notification for new buyer
    if (role === "BUYER") {
      try {
        const { createNotification } = await import("@/lib/notification-service");
        await createNotification(
          user.id,
          "Welcome to EarthCentric! 🌿",
          `Thank you for registering, ${user.name || name}! Enjoy 15% OFF your first order using code WELCOME15 at checkout.`,
          "/marketplace"
        );
      } catch (e) {
        console.error("Failed to create welcome notification:", e);
      }
    }

    // Send welcome email in background
    sendWelcomeEmail(user.email, user.name || name).catch((err) =>
      console.error("Failed to send welcome email:", err)
    );

    const finalUser = {
      id: user.id,
      name: user.name || "",
      email: user.email,
      role: user.role,
      sellerStatus: undefined,
      sellerId: undefined,
      badges: [],
    };
    
    await setEarthcentricSessionCookie({ id: user.id, role: user.role });

    return {
      success: true,
      user: finalUser
    };
  } catch (error) {
    console.error("Signup server action failed:", error);
    return { success: false, error: "An unexpected error occurred during registration." };
  }
}


export async function logoutUser() {
  const cookieStore = await cookies();
  cookieStore.delete('earthcentric_session');
}

export async function syncUserInDb(userData: {
  id: string;
  email: string;
}) {
  let identity: Awaited<ReturnType<typeof getVerifiedClerkIdentity>>;
  try {
    identity = await getVerifiedClerkIdentity();
  } catch (error) {
    console.error("Failed to verify Clerk identity:", error);
    return {
      success: false as const,
      error: "Your signed-in account could not be verified. Sign out and sign in again.",
    };
  }
  if (
    !identity ||
    identity.id !== userData.id ||
    identity.email !== userData.email.trim().toLowerCase()
  ) {
    return {
      success: false as const,
      error: "Your signed-in Clerk account could not be verified. Sign out and sign in again.",
    };
  }
  const normalizedUserDataEmail = identity.email;
  const isSuperAdminFallback = isSuperAdminEmail(identity.email);
  const isConfiguredSellerFallback = isConfiguredSellerEmail(identity.email);

  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
    const role = isSuperAdminFallback ? "ADMIN" : (isConfiguredSellerFallback ? "SELLER" : "BUYER");
    const fallbackUser = {
      id: identity.id,
      name: identity.name || normalizedUserDataEmail.split("@")[0],
      email: normalizedUserDataEmail,
      phone: null,
      role: role as any,
      sellerStatus: isConfiguredSellerFallback ? ("APPROVED" as const) : undefined,
      sellerId: isConfiguredSellerFallback ? "cmvcbbtm80001txgw8dd0r3lk" : undefined,
      badges: isConfiguredSellerFallback ? ["Verified Business", "Eco Certified"] : [],
      isNewUser: false,
    };
    await setEarthcentricSessionCookie({
      id: fallbackUser.id,
      role: fallbackUser.role,
      sellerStatus: fallbackUser.sellerStatus,
    }).catch(() => {});
    return {
      success: true as const,
      user: fallbackUser,
    };
  }

  try {
    const normalizedEmail = identity.email;

    const existingUser = await db.user.findUnique({
      where: { email: normalizedEmail },
      include: { seller: true },
    });

    const isSuperAdmin = isSuperAdminEmail(normalizedEmail);
    const isConfiguredSeller = isConfiguredSellerEmail(normalizedEmail);
    const targetRole = isSuperAdmin
      ? "ADMIN"
      : existingUser?.role === "ADMIN"
        ? "ADMIN"
        : existingUser?.seller
          ? "SELLER"
          : isConfiguredSeller
            ? "SELLER"
            : existingUser?.role || "BUYER";

    // Upsert the User record in database
    const user = await db.user.upsert({
      where: { email: normalizedEmail },
      update: {
        name: identity.name,
        ...(identity.image ? { image: identity.image } : {}),
        role: targetRole,
        emailVerified: existingUser?.emailVerified ?? new Date(),
      },
      create: {
        id: identity.id,
        name: identity.name,
        image: identity.image,
        email: normalizedEmail,
        role: targetRole,
        emailVerified: new Date(),
      },
      include: {
        seller: true,
      },
    });

    // Send welcome email only for new users
    if (!existingUser) {
      await sendWelcomeEmail(user.email, user.name || identity.name).catch((err) =>
        console.error("Failed to send welcome email:", err)
      );
    }

    const finalUser = {
      id: user.id,
      name: user.name || "",
      email: user.email,
      phone: user.phone || null,
      role: user.role as any,
      sellerStatus: user.seller?.verificationStatus as any,
      sellerId: user.seller?.id,
      badges: user.seller?.badges || [],
      isNewUser: !existingUser,
    };
    
    await setEarthcentricSessionCookie({
      id: user.id,
      role: user.role,
      sellerStatus: user.seller?.verificationStatus,
    });

    return { success: true as const, user: finalUser };
  } catch (error) {
    console.error("Failed to sync user in database:", error);
    // If database is temporarily unreachable, do not lock out an authenticated user whose Clerk identity is valid
    try {
      const identity = await getVerifiedClerkIdentity();
      if (identity) {
        const isSuperAdmin = isSuperAdminEmail(identity.email);
        const isConfiguredSeller = isConfiguredSellerEmail(identity.email);
        const targetRole = isSuperAdmin ? "ADMIN" : (isConfiguredSeller ? "SELLER" : "BUYER");
        const fallbackUser = {
          id: identity.id,
          name: identity.name,
          email: identity.email,
          phone: null,
          role: targetRole as any,
          sellerStatus: isConfiguredSeller ? ("APPROVED" as const) : undefined,
          sellerId: isConfiguredSeller ? "cmvcbbtm80001txgw8dd0r3lk" : undefined,
          badges: isConfiguredSeller ? ["Verified Business", "Eco Certified"] : [],
          isNewUser: false,
        };
        await setEarthcentricSessionCookie({
          id: identity.id,
          role: fallbackUser.role,
          sellerStatus: fallbackUser.sellerStatus,
        }).catch(() => {});
        return { success: true as const, user: fallbackUser };
      }
    } catch (e) {}

    const prismaCode =
      typeof error === "object" && error !== null && "code" in error
        ? error.code
        : undefined;
    if (prismaCode === "P2021" || prismaCode === "P2022") {
      return {
        success: false as const,
        error:
          "The production database schema is out of date. Back up the database, review the Prisma schema changes, then apply them before signing in.",
      };
    }
    return {
      success: false as const,
      error: "Your account could not be loaded from the database. Check the production database connection and try again.",
    };
  }
}

export async function setSellerSessionCookie(
  userId: string,
  _role: string = "SELLER",
  _sellerStatus: string = "APPROVED"
) {
  try {
    void _role;
    void _sellerStatus;
    const identity = await verifyAuthenticatedUser();
    if (
      !identity.authorized ||
      !identity.userId ||
      identity.userId !== userId ||
      identity.role !== "SELLER" ||
      !identity.sellerId
    ) return { success: false };

    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      await setEarthcentricSessionCookie({
        id: identity.userId,
        role: "SELLER",
        sellerStatus: "APPROVED",
      });
      return { success: true };
    }

    const seller = await db.seller.findUnique({
      where: { id: identity.sellerId },
      select: { verificationStatus: true },
    });
    if (!seller) return { success: false };

    await setEarthcentricSessionCookie({
      id: identity.userId,
      role: "SELLER",
      sellerStatus: seller.verificationStatus,
    });
    return { success: true };
  } catch (e) {
    console.error("Failed to set seller session cookie:", e);
    return { success: false };
  }
}

export async function setAdminSessionCookie(userId?: string) {
  try {
    const identity = await verifyAuthenticatedUser();
    const admin = await verifyAdminAuth();
    if (
      !identity.authorized ||
      !identity.userId ||
      !admin.authorized ||
      admin.userId !== identity.userId ||
      (userId && identity.userId !== userId)
    ) return { success: false };

    await setEarthcentricSessionCookie({ id: identity.userId, role: "ADMIN" });
    return { success: true };
  } catch (e) {
    console.error("Failed to set admin session cookie:", e);
    return { success: false };
  }
}

export async function updateUserProfilePicture(_userId: string, base64Image: string): Promise<string> {
  const auth = await verifyAuthenticatedUser();
  if (!auth.authorized || !auth.userId) {
    throw new Error("Sign in before updating your profile picture.");
  }
  const resultJson = await uploadImage(base64Image, "buyer-profile");
  
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
    return resultJson;
  }
  
  try {
    const existingUser = await db.user.findUnique({
      where: { id: auth.userId },
      select: { image: true }
    });
    
    if (existingUser && existingUser.image) {
      const oldPublicId = getPublicIdFromDb(existingUser.image);
      if (oldPublicId) {
        await deleteImage(oldPublicId);
      }
    }
    
    await db.user.update({
      where: { id: auth.userId },
      data: { image: resultJson }
    });
  } catch (error) {
    console.error("Failed to update user profile image in DB:", error);
  }
  
  return resultJson;
}
