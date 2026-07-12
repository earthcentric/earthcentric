import db from "./db";

// Map key to a human-friendly description
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

export async function getCredential(key: string, fallbackValue: string = ""): Promise<string> {
  try {
    // If DATABASE_URL is mock, don't query DB
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      return process.env[key] || fallbackValue;
    }

    const entry = await db.systemCredential.findUnique({
      where: { key },
    });

    if (entry) {
      return entry.value;
    }

    // Auto-migrate from environment variables if present
    const envVal = process.env[key];
    if (envVal !== undefined && envVal !== null && envVal !== "") {
      try {
        await db.systemCredential.create({
          data: {
            key,
            value: envVal,
            description: CREDENTIAL_DESCRIPTIONS[key] || "System integration setting",
          },
        });
        console.log(`Auto-migrated ${key} credential to database.`);
      } catch (err) {
        console.warn(`Failed to save auto-migrated credential ${key} to DB:`, err);
      }
      return envVal;
    }

    return fallbackValue;
  } catch (error) {
    console.error(`Error loading credential ${key} from DB, falling back to env:`, error);
    return process.env[key] || fallbackValue;
  }
}
