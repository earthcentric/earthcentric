import db from "./db";

// Map key to a human-friendly description
export const CREDENTIAL_DESCRIPTIONS: Record<string, string> = {
  SMTP_HOST: "SMTP server host address (e.g. smtp.gmail.com)",
  SMTP_PORT: "SMTP server port (e.g. 587 or 465)",
  SMTP_USER: "SMTP email account username / email address",
  SMTP_PASS: "SMTP account app password / credentials",
  SMTP_FROM: "SMTP default sender name and email",
  CLOUDINARY_CLOUD_NAME: "Cloudinary cloud name",
  CLOUDINARY_API_KEY: "Cloudinary API key ID",
  CLOUDINARY_API_SECRET: "Cloudinary API secret key",
  CASHFREE_APP_ID: "Cashfree Payment Gateway App ID (Collection / Checkout)",
  CASHFREE_SECRET_KEY: "Cashfree Payment Gateway Secret Key (Collection / Checkout)",
  CASHFREE_PAYOUT_CLIENT_ID: "Cashfree Payouts API Client ID (Disbursements / Seller Withdrawals)",
  CASHFREE_PAYOUT_CLIENT_SECRET: "Cashfree Payouts API Client Secret (Disbursements / Seller Withdrawals)",
  CASHFREE_PAYOUT_ENV: "Cashfree Payouts API Environment (SANDBOX or PRODUCTION)",
  RAZORPAY_KEY_ID: "Razorpay integration Key ID",
  RAZORPAY_KEY_SECRET: "Razorpay integration Key Secret",
};

/**
 * Retrieve a system credential following a strict precedence rule:
 * 1. Database-backed SystemCredential (if exists and contains non-empty, trimmed value).
 *    This allows Super Admin live updates via the Credentials Manager without server redeployment.
 * 2. Server Environment Variable (process.env) if set and non-empty.
 *    Note: Empty or whitespace-only database records will NEVER override a valid environment variable.
 * 3. Fallback default value.
 */
export async function getCredential(key: string, fallbackValue: string = ""): Promise<string> {
  try {
    // Priority 1: Database record (if it exists in real DB mode and has non-empty trimmed value)
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("mock")) {
      const entry = await db.systemCredential.findUnique({
        where: { key },
      });
      if (entry && typeof entry.value === "string" && entry.value.trim() !== "") {
        return entry.value.trim();
      }
    }

    // Priority 2: Environment variable (.env / process.env) if set and non-empty
    const envVal = process.env[key];
    if (envVal !== undefined && envVal !== null && envVal.trim() !== "") {
      return envVal.trim();
    }

    return fallbackValue;
  } catch (error) {
    console.error(`Error loading credential ${key}:`, error);
    const envVal = process.env[key];
    return envVal && envVal.trim() !== "" ? envVal.trim() : fallbackValue;
  }
}
