"use server";

import db from "@/lib/db";
import { getCredential } from "@/lib/credentials";

const CREDENTIAL_KEYS = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
];

const CREDENTIAL_DESCRIPTIONS: Record<string, string> = {
  SMTP_HOST: "SMTP server host address (e.g. smtp.gmail.com)",
  SMTP_PORT: "SMTP server port (e.g. 587 or 465)",
  SMTP_USER: "SMTP email account username / email address",
  SMTP_PASS: "SMTP account app password / credentials",
  SMTP_FROM: "SMTP default sender name and email",
  CLOUDINARY_CLOUD_NAME: "Cloudinary cloud name",
  CLOUDINARY_API_KEY: "Cloudinary API key ID",
  CLOUDINARY_API_SECRET: "Cloudinary API secret key",
  RAZORPAY_KEY_ID: "Razorpay integration Key ID",
  RAZORPAY_KEY_SECRET: "Razorpay integration Key Secret",
};

export interface CredentialItem {
  key: string;
  value: string;
  description: string;
}

/**
 * Fetches all integration/portal credentials from the database.
 * Auto-populates them from environment variables if not yet present in the DB.
 */
export async function getIntegrationCredentials(): Promise<CredentialItem[]> {
  try {
    // Ensure all known keys are initialized/auto-migrated and sync env vars to DB
    for (const key of CREDENTIAL_KEYS) {
      await getCredential(key);
      const envVal = process.env[key];
      if (envVal !== undefined && envVal !== null && envVal !== "" && process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("mock")) {
        try {
          await db.systemCredential.upsert({
            where: { key },
            update: { value: envVal },
            create: {
              key,
              value: envVal,
              description: CREDENTIAL_DESCRIPTIONS[key] || "System integration setting",
            },
          });
        } catch (e) {
          // Ignore sync errors
        }
      }
    }

    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      // Return env keys directly in mock mode
      return CREDENTIAL_KEYS.map((key) => ({
        key,
        value: process.env[key] || "",
        description: CREDENTIAL_DESCRIPTIONS[key] || "System integration setting",
      }));
    }

    const credentials = await db.systemCredential.findMany({
      orderBy: { key: "asc" },
    });

    return credentials.map((c) => ({
      key: c.key,
      value: process.env[c.key] || c.value,
      description: c.description || CREDENTIAL_DESCRIPTIONS[c.key] || "System integration setting",
    }));
  } catch (error) {
    console.error("Failed to load integration credentials:", error);
    // Fallback to env vars on database issues
    return CREDENTIAL_KEYS.map((key) => ({
      key,
      value: process.env[key] || "",
      description: CREDENTIAL_DESCRIPTIONS[key] || "System integration setting",
    }));
  }
}

/**
 * Updates a specific integration/portal credential in the database.
 */
export async function updateIntegrationCredential(key: string, value: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      return { success: false, error: "Cannot modify credentials in offline/mock database mode." };
    }

    // Update in-memory process.env so it takes immediate effect
    process.env[key] = value;

    await db.systemCredential.upsert({
      where: { key },
      update: { value, updatedAt: new Date() },
      create: {
        key,
        value,
        description: CREDENTIAL_DESCRIPTIONS[key] || "System integration setting",
      },
    });

    return { success: true };
  } catch (error: any) {
    console.error(`Failed to update credential ${key}:`, error);
    return { success: false, error: error.message || "An unexpected error occurred while saving credential." };
  }
}

/**
 * Returns the Razorpay key ID for client side initialization.
 */
export async function getRazorpayKeyId(): Promise<string> {
  try {
    return await getCredential("RAZORPAY_KEY_ID", "rzp_test_mock");
  } catch (e) {
    return process.env.RAZORPAY_KEY_ID || "rzp_test_mock";
  }
}
