"use server";

import db from "@/lib/db";
import { getCredential, CREDENTIAL_DESCRIPTIONS } from "@/lib/credentials";
import { verifyAdminAuth } from "@/lib/auth-server";

const CREDENTIAL_KEYS = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "CASHFREE_APP_ID",
  "CASHFREE_SECRET_KEY",
  "CASHFREE_PAYOUT_CLIENT_ID",
  "CASHFREE_PAYOUT_CLIENT_SECRET",
  "CASHFREE_PAYOUT_ENV",
];

const SECRET_MASK = "••••••••••••";

function isSecretKey(key: string): boolean {
  const k = key.toUpperCase();
  return k.includes("PASS") || k.includes("SECRET") || k.endsWith("_KEY");
}

export interface CredentialItem {
  key: string;
  value: string;
  description: string;
  isSecret?: boolean;
  hasValue?: boolean;
}

/**
 * Fetches all integration/portal credentials from the database.
 * Never exposes sensitive secrets (such as CASHFREE_PAYOUT_CLIENT_SECRET) in plain text.
 */
export async function getIntegrationCredentials(): Promise<CredentialItem[]> {
  try {
    const auth = await verifyAdminAuth();
    if (!auth.authorized) {
      return [];
    }

    // Ensure all known keys are initialized/auto-migrated and sync env vars to DB if DB is empty
    for (const key of CREDENTIAL_KEYS) {
      const envVal = process.env[key];
      if (
        envVal !== undefined &&
        envVal !== null &&
        envVal.trim() !== "" &&
        process.env.DATABASE_URL &&
        !process.env.DATABASE_URL.includes("mock")
      ) {
        try {
          const existing = await db.systemCredential.findUnique({ where: { key } });
          if (!existing) {
            await db.systemCredential.create({
              data: {
                key,
                value: envVal.trim(),
                description: CREDENTIAL_DESCRIPTIONS[key] || "System integration setting",
              },
            });
          }
        } catch (e) {
          // Ignore sync errors
        }
      }
    }

    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      return CREDENTIAL_KEYS.map((key) => {
        const val = process.env[key] || "";
        const secret = isSecretKey(key);
        return {
          key,
          value: secret && val ? SECRET_MASK : val,
          description: CREDENTIAL_DESCRIPTIONS[key] || "System integration setting",
          isSecret: secret,
          hasValue: Boolean(val),
        };
      });
    }

    const dbEntries = await db.systemCredential.findMany({
      orderBy: { key: "asc" },
    });
    const entryMap = new Map(dbEntries.map((e) => [e.key, e]));

    return CREDENTIAL_KEYS.map((key) => {
      const entry = entryMap.get(key);
      const rawValue = (entry?.value && entry.value.trim() !== "") ? entry.value.trim() : (process.env[key] || "");
      const secret = isSecretKey(key);
      const hasValue = Boolean(rawValue && rawValue.trim() !== "");

      return {
        key,
        // Never return the payout client secret or other secrets in plain text to the browser
        value: secret && hasValue ? SECRET_MASK : (secret ? "" : rawValue),
        description: entry?.description || CREDENTIAL_DESCRIPTIONS[key] || "System integration setting",
        isSecret: secret,
        hasValue,
      };
    });
  } catch (error) {
    console.error("Failed to load integration credentials:", error);
    return CREDENTIAL_KEYS.map((key) => {
      const envVal = process.env[key] || "";
      const secret = isSecretKey(key);
      return {
        key,
        value: secret && envVal ? SECRET_MASK : (secret ? "" : envVal),
        description: CREDENTIAL_DESCRIPTIONS[key] || "System integration setting",
        isSecret: secret,
        hasValue: Boolean(envVal),
      };
    });
  }
}

/**
 * Updates a specific integration/portal credential in the database.
 */
export async function updateIntegrationCredential(
  key: string,
  value: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await verifyAdminAuth();
    if (!auth.authorized) {
      return { success: false, error: "Super Admin authorization required." };
    }

    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      return { success: false, error: "Cannot modify credentials in offline/mock database mode." };
    }

    const trimmedValue = value.trim();

    // If a masked secret was submitted without being edited, preserve existing value without overwriting
    if (trimmedValue === SECRET_MASK || trimmedValue === "••••••••") {
      return { success: true };
    }

    // Update in-memory process.env so it takes immediate effect in current worker
    if (trimmedValue !== "") {
      process.env[key] = trimmedValue;
    } else {
      delete process.env[key];
    }

    await db.systemCredential.upsert({
      where: { key },
      update: { value: trimmedValue, updatedAt: new Date() },
      create: {
        key,
        value: trimmedValue,
        description: CREDENTIAL_DESCRIPTIONS[key] || "System integration setting",
      },
    });

    console.log(`[Credentials] Updated ${key} successfully in database.`);
    return { success: true };
  } catch (error: any) {
    console.error(`Failed to update credential ${key}:`, error);
    return { success: false, error: error.message || "An unexpected error occurred while saving credential." };
  }
}

/**
 * Returns the Cashfree App ID for client side initialization.
 */
export async function getCashfreeAppId(): Promise<string> {
  try {
    return await getCredential("CASHFREE_APP_ID", "cf_test_mock");
  } catch (e) {
    return process.env.CASHFREE_APP_ID || "cf_test_mock";
  }
}
