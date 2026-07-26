"use server";

import db from "@/lib/db";
import crypto from "crypto";
import { sendEmail } from "@/lib/email";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AddressData {
  id?: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault?: boolean;
}

export interface BuyerProfileData {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  image: string | null;
}

// ─── In-memory OTP store for password change ─────────────────────────────────
const changePasswordOtpStore = new Map<string, { otp: string; expiresAt: number }>();

function hashValue(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ─── Profile Actions ──────────────────────────────────────────────────────────

export async function getBuyerProfile(userId: string): Promise<BuyerProfileData | null> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, phone: true, image: true },
    });
    if (!user) return null;
    return {
      id: user.id,
      name: user.name || "",
      email: user.email,
      phone: user.phone || null,
      image: user.image || null,
    };
  } catch (e) {
    console.error("getBuyerProfile failed:", e);
    return null;
  }
}

export async function updateBuyerProfile(
  userId: string,
  data: { name: string; phone?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.user.update({
      where: { id: userId },
      data: {
        name: data.name.trim(),
        phone: data.phone?.trim() || null,
      },
    });
    return { success: true };
  } catch (e) {
    console.error("updateBuyerProfile failed:", e);
    return { success: false, error: "Failed to update profile. Please try again." };
  }
}

// ─── Address Actions ──────────────────────────────────────────────────────────

export async function getUserAddresses(userId: string): Promise<AddressData[]> {
  try {
    const addresses = await db.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { id: "asc" }],
    });
    return addresses.map((a) => ({
      id: a.id,
      street: a.street,
      city: a.city,
      state: a.state,
      postalCode: a.postalCode,
      country: a.country,
      isDefault: a.isDefault,
    }));
  } catch (e) {
    console.error("getUserAddresses failed:", e);
    return [];
  }
}

export async function addUserAddress(
  userId: string,
  address: Omit<AddressData, "id">
): Promise<{ success: boolean; address?: AddressData; error?: string }> {
  try {
    // If this is the first address, make it default automatically
    const count = await db.address.count({ where: { userId } });
    const isDefault = count === 0 ? true : (address.isDefault ?? false);

    if (isDefault) {
      // Clear existing default
      await db.address.updateMany({ where: { userId }, data: { isDefault: false } });
    }

    const created = await db.address.create({
      data: {
        userId,
        street: address.street.trim(),
        city: address.city.trim(),
        state: address.state.trim(),
        postalCode: address.postalCode.trim(),
        country: address.country.trim(),
        isDefault,
      },
    });
    return {
      success: true,
      address: {
        id: created.id,
        street: created.street,
        city: created.city,
        state: created.state,
        postalCode: created.postalCode,
        country: created.country,
        isDefault: created.isDefault,
      },
    };
  } catch (e) {
    console.error("addUserAddress failed:", e);
    return { success: false, error: "Failed to save address. Please try again." };
  }
}

export async function updateUserAddress(
  addressId: string,
  userId: string,
  address: Omit<AddressData, "id">
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verify ownership
    const existing = await db.address.findFirst({ where: { id: addressId, userId } });
    if (!existing) return { success: false, error: "Address not found." };

    await db.address.update({
      where: { id: addressId },
      data: {
        street: address.street.trim(),
        city: address.city.trim(),
        state: address.state.trim(),
        postalCode: address.postalCode.trim(),
        country: address.country.trim(),
      },
    });
    return { success: true };
  } catch (e) {
    console.error("updateUserAddress failed:", e);
    return { success: false, error: "Failed to update address." };
  }
}

export async function deleteUserAddress(
  addressId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const existing = await db.address.findFirst({ where: { id: addressId, userId } });
    if (!existing) return { success: false, error: "Address not found." };

    await db.address.delete({ where: { id: addressId } });

    // If we deleted the default, promote the next address
    if (existing.isDefault) {
      const next = await db.address.findFirst({ where: { userId }, orderBy: { id: "asc" } });
      if (next) await db.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }

    return { success: true };
  } catch (e) {
    console.error("deleteUserAddress failed:", e);
    return { success: false, error: "Failed to delete address." };
  }
}

export async function setDefaultAddress(
  addressId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.address.updateMany({ where: { userId }, data: { isDefault: false } });
    await db.address.update({ where: { id: addressId }, data: { isDefault: true } });
    return { success: true };
  } catch (e) {
    console.error("setDefaultAddress failed:", e);
    return { success: false, error: "Failed to set default address." };
  }
}

// ─── Change Password OTP ──────────────────────────────────────────────────────

export async function sendChangePasswordOtp(
  email: string
): Promise<{ success: boolean; isMock?: boolean; otp?: string; error?: string }> {
  try {
    const normalizedEmail = email.toLowerCase().trim();

    const otp = generateOtp();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    changePasswordOtpStore.set(normalizedEmail, { otp, expiresAt });

    console.log(`\n╔══════════════════════════════════════╗`);
    console.log(`║   🔐  CHANGE PASSWORD OTP CODE        ║`);
    console.log(`║   Email : ${normalizedEmail.padEnd(26)}║`);
    console.log(`║   OTP   : ${otp}                        ║`);
    console.log(`╚══════════════════════════════════════╝\n`);

    const result = await sendEmail({
      to: normalizedEmail,
      subject: `Your EarthCentric Password Change Code: ${otp}`,
      html: `
        <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: auto; padding: 0; border-radius: 16px; overflow: hidden; border: 1px solid #D8CEBE; background: #FFFFFF;">
          <div style="background: linear-gradient(135deg, #1F3A2E 0%, #2D5A40 100%); padding: 28px 32px; text-align: center;">
            <h1 style="color: #F5F1EA; font-size: 28px; font-weight: 900; margin: 0;">Earth Centric 🌿</h1>
            <p style="color: rgba(245,241,234,0.65); font-size: 13px; margin: 8px 0 0 0;">Premium Sustainable Marketplace</p>
          </div>
          <div style="padding: 32px 28px;">
            <h2 style="color: #1F3A2E; font-size: 22px; margin: 0 0 12px 0;">Password Change Request 🔐</h2>
            <p style="color: #333; font-size: 14px; line-height: 1.7; margin: 0 0 8px 0;">
              Use the verification code below to change your password:
            </p>
            <div style="text-align: center; margin: 28px 0;">
              <div style="display: inline-block; background: linear-gradient(135deg, #1F3A2E 0%, #2D5A40 100%); border-radius: 16px; padding: 20px 36px;">
                <span style="font-size: 36px; font-weight: 800; letter-spacing: 12px; color: #F5F1EA; font-family: monospace;">${otp}</span>
              </div>
            </div>
            <p style="color: #888; font-size: 12px; text-align: center;">This code expires in <strong>10 minutes</strong>. Do not share it.</p>
            <div style="background: #FFF8F0; border: 1px solid #F0E0C8; border-radius: 12px; padding: 14px 18px; margin: 16px 0;">
              <p style="color: #6B4F3A; font-size: 12px; margin: 0;">⚠️ If you did not request this, please ignore this email. Your account is secure.</p>
            </div>
          </div>
          <div style="background: #F5F1EA; padding: 20px 28px; border-top: 1px solid #D8CEBE; text-align: center;">
            <p style="font-size: 11px; color: #5A5A5A; margin: 0;">© ${new Date().getFullYear()} EarthCentric. Carbon-Neutral Operations Since Day One.</p>
          </div>
        </div>
      `,
    });

    const isMock = !result.success || result.isMock;
    return {
      success: true,
      isMock,
      otp: process.env.NODE_ENV === "development" ? otp : undefined,
    };
  } catch (e) {
    console.error("sendChangePasswordOtp failed:", e);
    return { success: false, error: "Failed to send OTP. Please try again." };
  }
}

export async function verifyChangePasswordOtp(
  email: string,
  otp: string
): Promise<{ success: boolean; error?: string }> {
  const normalizedEmail = email.toLowerCase().trim();
  const stored = changePasswordOtpStore.get(normalizedEmail);

  if (!stored) return { success: false, error: "No OTP found. Please request a new one." };
  if (Date.now() > stored.expiresAt) {
    changePasswordOtpStore.delete(normalizedEmail);
    return { success: false, error: "OTP has expired. Please request a new one." };
  }
  if (stored.otp !== otp) {
    return { success: false, error: "Incorrect OTP. Please try again." };
  }

  // Mark as verified by removing from store (consumed)
  changePasswordOtpStore.delete(normalizedEmail);
  return { success: true };
}

export async function changePassword(
  userId: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (newPassword.length < 6) {
      return { success: false, error: "Password must be at least 6 characters." };
    }
    const hashed = hashValue(newPassword);
    await db.user.update({ where: { id: userId }, data: { password: hashed } });
    return { success: true };
  } catch (e) {
    console.error("changePassword failed:", e);
    return { success: false, error: "Failed to update password. Please try again." };
  }
}
