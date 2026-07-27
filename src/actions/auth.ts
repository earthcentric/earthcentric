"use server";

import db from "@/lib/db";
import { sendWelcomeEmail } from "@/lib/email";
import { uploadImage, deleteImage, getPublicIdFromDb } from "@/lib/cloudinary";
import crypto from "crypto";
import { cookies } from "next/headers";

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
    
    // Await the cookies() call in Next.js 15+
    const cookieStore = await cookies();
    cookieStore.set('earthcentric_session', JSON.stringify({
      id: user.id,
      role: user.role,
      sellerStatus: user.seller?.verificationStatus
    }), { httpOnly: true, secure: process.env.NODE_ENV === 'production', path: '/' });

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
        role: role as any,
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
        const { createNotification } = await import("@/actions/notifications");
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
    
    // Await the cookies() call in Next.js 15+
    const cookieStore = await cookies();
    cookieStore.set('earthcentric_session', JSON.stringify({
      id: user.id,
      role: user.role
    }), { httpOnly: true, secure: process.env.NODE_ENV === 'production', path: '/' });

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
  name: string;
  email: string;
  role: string;
}) {
  try {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      // Send welcome email even in mock mode
      await sendWelcomeEmail(userData.email, userData.name).catch((err) =>
        console.error("Failed to send welcome email:", err)
      );
      return null;
    }

    const existingUser = await db.user.findUnique({
      where: { email: userData.email.toLowerCase() },
    });

    const isEmailAdmin = userData.email.toLowerCase().includes("admin") || userData.email.toLowerCase() === "rkearthcentric@gmail.com";
    const targetRole = isEmailAdmin ? "ADMIN" : (existingUser ? existingUser.role : (userData.role as any));

    // Upsert the User record in database
    const user = await db.user.upsert({
      where: { email: userData.email.toLowerCase() },
      update: {
        name: userData.name,
        role: targetRole,
      },
      create: {
        id: userData.id,
        name: userData.name,
        email: userData.email.toLowerCase(),
        role: targetRole,
      },
      include: {
        seller: true,
      },
    });

    // Send welcome email only for new users
    if (!existingUser) {
      await sendWelcomeEmail(user.email, user.name || userData.name).catch((err) =>
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
    
    const cookieStore = await cookies();
    cookieStore.set('earthcentric_session', JSON.stringify({
      id: user.id,
      role: user.role,
      sellerStatus: user.seller?.verificationStatus
    }), { httpOnly: true, secure: process.env.NODE_ENV === 'production', path: '/' });

    return finalUser;
  } catch (error) {
    console.error("Failed to sync user in database:", error);
    return null;
  }
}

export async function updateUserProfilePicture(userId: string, base64Image: string): Promise<string> {
  const resultJson = await uploadImage(base64Image, "buyer-profile");
  
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
    return resultJson;
  }
  
  try {
    const existingUser = await db.user.findUnique({
      where: { id: userId },
      select: { image: true }
    });
    
    if (existingUser && existingUser.image) {
      const oldPublicId = getPublicIdFromDb(existingUser.image);
      if (oldPublicId) {
        await deleteImage(oldPublicId);
      }
    }
    
    await db.user.update({
      where: { id: userId },
      data: { image: resultJson }
    });
  } catch (error) {
    console.error("Failed to update user profile image in DB:", error);
  }
  
  return resultJson;
}
