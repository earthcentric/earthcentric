import db from "./db";
import { getCredential } from "./credentials";

export const DEFAULT_REGISTRATION_FEE_AMOUNT = 1.0; // ₹1 INR
export const DEFAULT_MIN_WITHDRAWAL_AMOUNT = 1.0; // ₹1 INR

/**
 * Returns whether the seller registration fee (₹1) is currently enabled.
 * Default is FALSE (disabled) as required by the business specification.
 */
export async function isSellerRegistrationFeeEnabled(): Promise<boolean> {
  try {
    const val = await getCredential("SELLER_REGISTRATION_FEE_ENABLED", "false");
    return val === "true" || val === "1" || val === "enabled";
  } catch {
    return false;
  }
}

/**
 * Returns the configured registration fee amount (₹1).
 */
export async function getSellerRegistrationFeeAmount(): Promise<number> {
  try {
    const val = await getCredential("SELLER_REGISTRATION_FEE_AMOUNT", String(DEFAULT_REGISTRATION_FEE_AMOUNT));
    const parsed = parseFloat(val);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_REGISTRATION_FEE_AMOUNT;
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
