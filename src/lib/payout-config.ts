import db from "./db";
import { getCredential } from "./credentials";

export const DEFAULT_REGISTRATION_FEE_AMOUNT = 1.0; // ₹1 INR
export const DEFAULT_MIN_WITHDRAWAL_AMOUNT = 1.0; // ₹1 INR

/**
 * Returns whether the seller registration fee (₹1) is currently enabled.
 * Database SystemCredential is authoritative so Super Admin dynamic toggles take effect.
 * Falls back to SELLER_REGISTRATION_FEE_ENABLED environment variable.
 */
export async function isSellerRegistrationFeeEnabled(): Promise<boolean> {
  try {
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("mock")) {
      const entry = await db.systemCredential.findUnique({
        where: { key: "SELLER_REGISTRATION_FEE_ENABLED" },
      });
      if (entry && entry.value !== undefined && entry.value !== null && entry.value.trim() !== "") {
        const val = entry.value.trim().toLowerCase();
        return val === "true" || val === "1" || val === "enabled";
      }
    }
    const envVal = (process.env.SELLER_REGISTRATION_FEE_ENABLED || "").trim().toLowerCase();
    if (envVal !== "") {
      return envVal === "true" || envVal === "1" || envVal === "enabled";
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Returns the configured registration fee amount (₹1).
 * Database SystemCredential is authoritative, falling back to environment variable or default ₹1.00.
 */
export async function getSellerRegistrationFeeAmount(): Promise<number> {
  try {
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("mock")) {
      const entry = await db.systemCredential.findUnique({
        where: { key: "SELLER_REGISTRATION_FEE_AMOUNT" },
      });
      if (entry && entry.value) {
        const parsed = parseFloat(entry.value);
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
      }
    }
    const envVal = process.env.SELLER_REGISTRATION_FEE_AMOUNT;
    if (envVal) {
      const parsed = parseFloat(envVal);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    return DEFAULT_REGISTRATION_FEE_AMOUNT;
  } catch {
    return DEFAULT_REGISTRATION_FEE_AMOUNT;
  }
}

/**
 * Allows Super Admin to toggle the registration fee on/off and optionally configure the amount.
 */
export async function setSellerRegistrationFeeConfig(options: {
  enabled: boolean;
  amount?: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const isMock = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");
    if (!isMock) {
      await db.systemCredential.upsert({
        where: { key: "SELLER_REGISTRATION_FEE_ENABLED" },
        update: { value: options.enabled ? "true" : "false" },
        create: {
          key: "SELLER_REGISTRATION_FEE_ENABLED",
          value: options.enabled ? "true" : "false",
          description: "Controls whether newly approved sellers must pay the ₹1 registration fee before payout onboarding.",
        },
      });

      if (options.amount !== undefined && options.amount > 0) {
        await db.systemCredential.upsert({
          where: { key: "SELLER_REGISTRATION_FEE_AMOUNT" },
          update: { value: String(options.amount) },
          create: {
            key: "SELLER_REGISTRATION_FEE_AMOUNT",
            value: String(options.amount),
            description: "Seller registration fee amount in INR (default ₹1).",
          },
        });
      }
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to update configuration." };
  }
}

/**
 * Returns minimum withdrawable threshold.
 */
export async function getMinimumWithdrawalAmount(): Promise<number> {
  return DEFAULT_MIN_WITHDRAWAL_AMOUNT;
}
