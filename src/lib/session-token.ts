export const EARTHCENTRIC_SESSION_COOKIE = "earthcentric_session";

const SESSION_TTL_SECONDS = 8 * 60 * 60;

export interface EarthcentricSession {
  id: string;
  role: string;
  sellerStatus?: string;
  issuedAt: number;
  expiresAt: number;
}

interface SessionClaims {
  id: string;
  role: string;
  sellerStatus?: string;
}

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret || new TextEncoder().encode(secret).length < 32) {
    throw new Error("Set SESSION_SECRET (at least 32 characters) before using custom sessions.");
  }
  return secret;
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(normalized + "=".repeat((4 - (normalized.length % 4)) % 4));
    const decoded = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return encodeBase64Url(decoded) === value ? decoded : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function getHmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function signEarthcentricSession(claims: SessionClaims): Promise<string> {
  if (!claims.id || !claims.role) {
    throw new Error("A user ID and role are required to create a session.");
  }
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = encodeBase64Url(
    new TextEncoder().encode(
      JSON.stringify({
        ...claims,
        issuedAt,
        expiresAt: issuedAt + SESSION_TTL_SECONDS,
      })
    )
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    await getHmacKey(),
    new TextEncoder().encode(payload)
  );
  return `${payload}.${encodeBase64Url(new Uint8Array(signature))}`;
}

export async function verifyEarthcentricSession(token: string): Promise<EarthcentricSession | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadPart, signaturePart] = parts;
  const payloadBytes = decodeBase64Url(payloadPart);
  const signatureBytes = decodeBase64Url(signaturePart);
  if (!payloadBytes || !signatureBytes) return null;
  const signatureBuffer = new Uint8Array(new ArrayBuffer(signatureBytes.byteLength));
  signatureBuffer.set(signatureBytes);

  const valid = await crypto.subtle.verify(
    "HMAC",
    await getHmacKey(),
    signatureBuffer,
    new TextEncoder().encode(payloadPart)
  );
  if (!valid) return null;

  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(payloadBytes));
  } catch {
    return null;
  }
  if (!isRecord(payload)) return null;

  const session = payload;
  const now = Math.floor(Date.now() / 1000);
  if (
    typeof session.id !== "string" ||
    !session.id ||
    (session.role !== "BUYER" && session.role !== "SELLER" && session.role !== "ADMIN") ||
    typeof session.issuedAt !== "number" ||
    typeof session.expiresAt !== "number" ||
    session.issuedAt > now + 60 ||
    session.expiresAt <= now ||
    session.expiresAt - session.issuedAt !== SESSION_TTL_SECONDS ||
    (session.sellerStatus !== undefined && typeof session.sellerStatus !== "string")
  ) {
    return null;
  }
  return {
    id: session.id,
    role: session.role,
    ...(typeof session.sellerStatus === "string" ? { sellerStatus: session.sellerStatus } : {}),
    issuedAt: session.issuedAt,
    expiresAt: session.expiresAt,
  };
}
