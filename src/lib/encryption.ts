import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 12 bytes recommended for GCM
const PREFIX = "enc:v1:";

/**
 * Derives a 32-byte key from environment secret.
 */
function getEncryptionKey(): Buffer {
  const secret =
    process.env.ENCRYPTION_KEY ||
    process.env.NEXTAUTH_SECRET ||
    "earthcentric-secure-storage-secret-key-32b!";
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Prepends prefix `enc:v1:` so encrypted strings can be unambiguously distinguished from legacy plain text.
 * Idempotent: if already encrypted, returns as-is.
 */
export function encrypt(text: string | null | undefined): string | null | undefined {
  if (!text) return text;
  if (typeof text !== "string") return text;
  if (text.startsWith(PREFIX)) return text; // Already encrypted

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag().toString("hex");
    return `${PREFIX}${iv.toString("hex")}:${authTag}:${encrypted}`;
  } catch (error) {
    console.error("Encryption failed:", error);
    // If encryption fails for any reason, return the text to avoid data loss
    return text;
  }
}

/**
 * Decrypts an encrypted string produced by `encrypt()`.
 * Backward-compatible: If the input does not start with `enc:v1:`, it is assumed to be legacy plain text
 * and returned without modification.
 */
export function decrypt(cipherText: string | null | undefined): string | null | undefined {
  if (!cipherText) return cipherText;
  if (typeof cipherText !== "string") return cipherText;
  if (!cipherText.startsWith(PREFIX)) {
    // Legacy plain text or unencrypted mock data
    return cipherText;
  }

  try {
    const raw = cipherText.slice(PREFIX.length);
    const [ivHex, authTagHex, encryptedHex] = raw.split(":");

    if (!ivHex || !authTagHex || !encryptedHex) {
      console.warn("Invalid encrypted string format, returning raw string");
      return cipherText;
    }

    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    console.error("Decryption failed:", error);
    return cipherText;
  }
}

/**
 * Safely masks an Aadhar number (e.g. "9876 5432 1098" -> "•••• •••• 1098")
 */
export function maskAadhar(aadhar: string | null | undefined): string {
  if (!aadhar) return "";
  const clean = aadhar.replace(/\s/g, "");
  if (clean.length < 4) return clean;
  const last4 = clean.slice(-4);
  return `•••• •••• ${last4}`;
}

/**
 * Safely masks a PAN number (e.g. "AAACB1234A" -> "••••••1234A")
 */
export function maskPan(pan: string | null | undefined): string {
  if (!pan) return "";
  const clean = pan.trim();
  if (clean.length < 5) return clean;
  const last5 = clean.slice(-5);
  return `•••••${last5}`;
}
