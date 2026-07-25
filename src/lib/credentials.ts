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
    // Priority 1: Environment variable (.env file) if set and non-empty
    const envVal = process.env[key];
    if (envVal !== undefined && envVal !== null && envVal !== "") {
      return envVal;
    }

    // Priority 2: Database record (if it exists in real DB mode)
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("mock")) {
      const entry = await db.systemCredential.findUnique({
        where: { key },
      });
      if (entry && entry.value) {
        return entry.value;
      }
    }

    return fallbackValue;
  } catch (error) {
    console.error(`Error loading credential ${key}:`, error);
    return process.env[key] || fallbackValue;
  }
}
