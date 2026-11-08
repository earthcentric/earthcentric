"use server";

import db from "@/lib/db";
import { Prisma } from "@prisma/client";
import crypto from "crypto";
import { sendEmail } from "@/lib/email";
import { verifyAuthenticatedUser } from "@/lib/auth-server";
import { reverseGeocode } from "@/lib/location-services";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AddressData {
  id?: string;
  label?: "Home" | "Office" | "Other";
  street: string;
  landmark?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  latitude?: number | null;
  longitude?: number | null;
  geocodingProvider?: string | null;
  providerLocationId?: string | null;
  isDefault?: boolean;
}

export interface BuyerProfileData {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  image: string | null;
}

const changePasswordOtpStore = new Map<
  string,
  {
    otp: string;
    expiresAt: number;
    attempts?: number;
    blockedUntil?: number;
  }
>();

function hashValue(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function validateAddressPayload(
  address: Omit<AddressData, "id">,
  verifyCoordinates = true
): Promise<string | null> {
  if (!address || !["Home", "Office", "Other"].includes(address.label || "Home")) {
    return "Choose a valid address label.";
  }
  const requiredText = [address.street, address.city, address.state, address.postalCode, address.country];
  if (requiredText.some((value) => typeof value !== "string" || !value.trim() || value.length > 300)) {
    return "Complete the address, city, state, country, and PIN code.";
  }
  if (!/^\d{6}$/.test(address.postalCode.trim())) {
    return "Enter a valid 6-digit PIN code.";
  }
  if (address.landmark != null && (typeof address.landmark !== "string" || address.landmark.length > 200)) {
    return "Landmark must be 200 characters or fewer.";
  }
  const hasLatitude = address.latitude !== null && address.latitude !== undefined;
  const hasLongitude = address.longitude !== null && address.longitude !== undefined;
  if (hasLatitude !== hasLongitude ||
      (hasLatitude && (!Number.isFinite(address.latitude) || address.latitude! < -90 || address.latitude! > 90)) ||
      (hasLongitude && (!Number.isFinite(address.longitude) || address.longitude! < -180 || address.longitude! > 180))) {
    return "The selected map coordinates are invalid.";
  }
  if (hasLatitude && verifyCoordinates) {
    if (address.geocodingProvider !== "Nominatim") {
      return "Map coordinates must come from the configured geocoding provider. You can still save the address manually without coordinates.";
    }
    const verifiedLocation = await reverseGeocode(address.latitude!, address.longitude!);
    if (!verifiedLocation || verifiedLocation.postalCode !== address.postalCode.trim()) {
      return "The selected map location could not be verified against this PIN code. Correct the PIN or save the address without map coordinates.";
    }
  }
  return null;
}

// ─── Profile Actions ──────────────────────────────────────────────────────────

export async function getBuyerProfile(userId: string, email?: string): Promise<BuyerProfileData | null> {
  try {
    const auth = await verifyAuthenticatedUser();
    if (!auth.authorized || !auth.userId || auth.userId !== userId) return null;
    void email;
    const user = await db.user.findUnique({
      where: { id: auth.userId },
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
  data: { name: string; phone?: string; email?: string }
): Promise<{ success: boolean; phone?: string | null; error?: string }> {
  try {
    const auth = await verifyAuthenticatedUser();
    if (!auth.authorized || !auth.userId) {
      return { success: false, error: "Unauthorized." };
    }
    const rawDigits = data.phone ? data.phone.replace(/\D/g, "") : "";
    const cleanPhone = rawDigits.length >= 10 ? rawDigits.slice(-10) : (rawDigits.length > 0 ? rawDigits : null);

    await db.user.update({
      where: { id: auth.userId },
      data: { name: data.name.trim(), phone: cleanPhone },
    });

    // 3. Keep seller record synced if this user is a seller
    await db.seller.updateMany({
      where: { userId: auth.userId },
      data: {
        ownerName: data.name.trim(),
        founderName: data.name.trim(),
        ...(cleanPhone ? { phone: cleanPhone } : {}),
      }
    });

    return { success: true, phone: cleanPhone };
  } catch (e) {
    console.error("updateBuyerProfile failed:", e);
    return { success: false, error: "Failed to update profile. Please try again." };
  }
}

// ─── Address Actions ──────────────────────────────────────────────────────────

export async function getUserAddresses(userId: string): Promise<AddressData[]> {
  try {
    const auth = await verifyAuthenticatedUser();
    if (!auth.authorized || !auth.userId || auth.userId !== userId) return [];
    const addresses = await db.address.findMany({
      where: {
        userId: auth.userId,
        // Exclude archived clones created to preserve order FK references after address deletion
        NOT: { street: { startsWith: "[Deleted]" } },
      },
      orderBy: [{ isDefault: "desc" }, { id: "asc" }],
    });
    return addresses.map((a: any) => ({
      id: a.id,
      label: a.label as AddressData["label"],
      street: a.street,
      landmark: a.landmark,
      city: a.city,
      state: a.state,
      postalCode: a.postalCode,
      country: a.country,
      latitude: a.latitude,
      longitude: a.longitude,
      geocodingProvider: a.geocodingProvider,
      providerLocationId: a.providerLocationId,
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
    const auth = await verifyAuthenticatedUser();
    if (!auth.authorized || !auth.userId) {
      return { success: false, error: "Unauthorized." };
    }
    if (auth.userId !== userId) return { success: false, error: "Unauthorized." };
    const validationError = await validateAddressPayload(address);
    if (validationError) return { success: false, error: validationError };
    const created = await db.$transaction(async (tx) => {
      const count = await tx.address.count({ where: { userId: auth.userId } });
      const isDefault = count === 0 || Boolean(address.isDefault);
      if (isDefault) {
        await tx.address.updateMany({ where: { userId: auth.userId }, data: { isDefault: false } });
      }
      return tx.address.create({
        data: {
          userId: auth.userId!,
          label: address.label || "Home",
          street: address.street.trim(),
          landmark: address.landmark?.trim() || null,
          city: address.city.trim(),
          state: address.state.trim(),
          postalCode: address.postalCode.trim(),
          country: address.country.trim(),
          latitude: address.latitude ?? null,
          longitude: address.longitude ?? null,
          geocodingProvider: address.geocodingProvider || null,
          providerLocationId: address.providerLocationId?.slice(0, 100) || null,
          isDefault,
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return {
      success: true,
      address: {
        id: created.id,
        label: created.label as AddressData["label"],
        street: created.street,
        landmark: created.landmark,
        city: created.city,
        state: created.state,
        postalCode: created.postalCode,
        country: created.country,
        latitude: created.latitude,
        longitude: created.longitude,
        geocodingProvider: created.geocodingProvider,
        providerLocationId: created.providerLocationId,
        isDefault: created.isDefault,
      },
    };
  } catch (e) {
    console.error("addUserAddress failed:", e);
    return {
      success: false,
      error: address?.latitude != null
        ? "Selected map coordinates could not be verified. Clear the map pin and save the address manually."
        : "Failed to save address. Please try again.",
    };
  }
}

export async function updateUserAddress(
  addressId: string,
  userId: string,
  address: Omit<AddressData, "id">
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await verifyAuthenticatedUser();
    if (!auth.authorized || !auth.userId) {
      return { success: false, error: "Unauthorized." };
    }
    if (auth.userId !== userId) return { success: false, error: "Unauthorized." };
    // Verify ownership
    const existing = await db.address.findFirst({ where: { id: addressId, userId: auth.userId } });
    if (!existing) return { success: false, error: "Address not found." };
    const unchangedLocation =
      existing.latitude === (address.latitude ?? null) &&
      existing.longitude === (address.longitude ?? null) &&
      existing.postalCode === address.postalCode.trim() &&
      existing.geocodingProvider === address.geocodingProvider &&
      existing.providerLocationId === (address.providerLocationId || null);
    const validationError = await validateAddressPayload(address, !unchangedLocation);
    if (validationError) return { success: false, error: validationError };

    await db.address.updateMany({
      where: { id: addressId, userId: auth.userId },
      data: {
        label: address.label || "Home",
        street: address.street.trim(),
        landmark: address.landmark?.trim() || null,
        city: address.city.trim(),
        state: address.state.trim(),
        postalCode: address.postalCode.trim(),
        country: address.country.trim(),
        latitude: address.latitude ?? null,
        longitude: address.longitude ?? null,
        geocodingProvider: address.geocodingProvider || null,
        providerLocationId: address.providerLocationId?.slice(0, 100) || null,
      },
    });
    return { success: true };
  } catch (e) {
    console.error("updateUserAddress failed:", e);
    return {
      success: false,
      error: address?.latitude != null
        ? "Selected map coordinates could not be verified. Clear the map pin and save the address manually."
        : "Failed to update address.",
    };
  }
}

export async function deleteUserAddress(
  addressId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await verifyAuthenticatedUser();
    if (!auth.authorized || !auth.userId) {
      return { success: false, error: "Unauthorized." };
    }
    if (auth.userId !== userId) return { success: false, error: "Unauthorized." };
    await db.$transaction(async (tx) => {
      const existing = await tx.address.findFirst({ where: { id: addressId, userId: auth.userId } });
      if (!existing) throw new Error("Address not found.");
      const linkedOrderCount = await tx.order.count({ where: { addressId, userId: auth.userId } });
      if (linkedOrderCount > 0) {
        const archivedClone = await tx.address.create({
          data: {
            userId: auth.userId!,
            street: `[Deleted] ${existing.street}`,
            city: existing.city,
            state: existing.state,
            postalCode: existing.postalCode,
            country: existing.country,
            label: existing.label,
            landmark: existing.landmark,
            latitude: existing.latitude,
            longitude: existing.longitude,
            geocodingProvider: existing.geocodingProvider,
            providerLocationId: existing.providerLocationId,
            isDefault: false,
          },
        });
        await tx.order.updateMany({
          where: { addressId, userId: auth.userId },
          data: { addressId: archivedClone.id },
        });
      }
      await tx.address.deleteMany({ where: { id: addressId, userId: auth.userId } });
      if (existing.isDefault) {
        const next = await tx.address.findFirst({
          where: { userId: auth.userId, street: { not: { startsWith: "[Deleted]" } } },
          orderBy: { id: "asc" },
        });
        if (next) await tx.address.updateMany({
          where: { id: next.id, userId: auth.userId },
          data: { isDefault: true },
        });
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return { success: true };
  } catch (e) {
    console.error("deleteUserAddress failed:", e);
    return { success: false, error: "Failed to delete address. Please try again." };
  }
}

export async function setDefaultAddress(
  addressId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await verifyAuthenticatedUser();
    if (!auth.authorized || !auth.userId) {
      return { success: false, error: "Unauthorized." };
    }
    if (auth.userId !== userId) return { success: false, error: "Unauthorized." };
    await db.$transaction(async (tx) => {
      const target = await tx.address.findFirst({
        where: {
          id: addressId,
          userId: auth.userId,
          NOT: { street: { startsWith: "[Deleted]" } },
        },
        select: { id: true },
      });
      if (!target) throw new Error("Address not found.");
      await tx.address.updateMany({ where: { userId: auth.userId }, data: { isDefault: false } });
      const updated = await tx.address.updateMany({
        where: { id: target.id, userId: auth.userId },
        data: { isDefault: true },
      });
      if (updated.count !== 1) throw new Error("Address ownership changed while updating the default.");
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
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

    const existing = changePasswordOtpStore.get(normalizedEmail);
    if (existing && existing.blockedUntil && Date.now() < existing.blockedUntil) {
      const remainingMins = Math.ceil((existing.blockedUntil - Date.now()) / (60 * 1000));
      return {
        success: false,
        error: `Too many failed attempts. Account is locked. Please try again in ${remainingMins} minute(s).`,
      };
    }

    const otp = generateOtp();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    changePasswordOtpStore.set(normalizedEmail, {
      otp,
      expiresAt,
      attempts: 0,
      blockedUntil: undefined,
    });

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

  if (stored.blockedUntil && Date.now() < stored.blockedUntil) {
    const remainingMins = Math.ceil((stored.blockedUntil - Date.now()) / (60 * 1000));
    return {
      success: false,
      error: `Too many failed attempts. Account is locked. Please try again in ${remainingMins} minute(s).`,
    };
  }

  if (Date.now() > stored.expiresAt) {
    changePasswordOtpStore.delete(normalizedEmail);
    return { success: false, error: "OTP has expired. Please request a new one." };
  }

  if (stored.otp !== otp) {
    const failedCount = (stored.attempts || 0) + 1;
    if (failedCount >= 5) {
      stored.blockedUntil = Date.now() + 15 * 60 * 1000;
      stored.attempts = failedCount;
      return {
        success: false,
        error: "Too many failed attempts (5/5). Account locked for 15 minutes.",
      };
    }
    stored.attempts = failedCount;
    const remaining = 5 - failedCount;
    return {
      success: false,
      error: `Incorrect OTP. You have ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
    };
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
