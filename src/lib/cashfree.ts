import { Cashfree, CFEnvironment } from "cashfree-pg";
import { getCredential } from "./credentials";
import crypto from "crypto";

export type CashfreeMode = "SANDBOX" | "PRODUCTION" | "MOCK";

export interface CashfreeOrderSession {
  order_id: string;
  payment_session_id: string;
  mode: CashfreeMode;
}

export interface CashfreeRefundResult {
  order_id?: string;
  refund_id?: string;
  cf_refund_id?: string | number;
  refund_amount?: number;
  refund_status?: string;
  refund_arn?: string;
  status_description?: string;
}

let cashfreeClient: Cashfree | null = null;
let cashfreeClientMode: "SANDBOX" | "PRODUCTION" | null = null;

export function getCashfreeMode(secretKey?: string): Exclude<CashfreeMode, "MOCK"> {
  // If the secret key has an explicit environment prefix, respect the key's native environment
  if (secretKey?.startsWith("cfsk_ma_prod_")) {
    return "PRODUCTION";
  }
  if (secretKey?.startsWith("cfsk_ma_test_")) {
    return "SANDBOX";
  }
  const env = (process.env.CASHFREE_ENVIRONMENT || "SANDBOX").toUpperCase();
  return env === "PRODUCTION" ? "PRODUCTION" : "SANDBOX";
}

export async function isCashfreeConfigured(): Promise<boolean> {
  const appId = await getCredential("CASHFREE_APP_ID");
  const secretKey = await getCredential("CASHFREE_SECRET_KEY");
  return !!appId && !!secretKey;
}

export async function getCashfreeClient(): Promise<{ client: Cashfree; mode: "SANDBOX" | "PRODUCTION" } | null> {
  const appId = (await getCredential("CASHFREE_APP_ID")) || process.env.CASHFREE_APP_ID;
  const secretKey = (await getCredential("CASHFREE_SECRET_KEY")) || process.env.CASHFREE_SECRET_KEY;

  if (!appId || !secretKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Cashfree credentials are not configured in the production environment.");
    }
    return null;
  }

  const mode = getCashfreeMode(secretKey);

  if (cashfreeClient && cashfreeClientMode === mode) {
    return { client: cashfreeClient, mode };
  }

  const environment = mode === "PRODUCTION" ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX;
  cashfreeClient = new Cashfree(environment, appId, secretKey);
  cashfreeClientMode = mode;
  return { client: cashfreeClient, mode };
}

export function getSecureAppUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;
  if (configured && configured.startsWith("https://")) {
    return configured.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`.replace(/\/$/, "");
  }
  if (configured && !configured.includes("localhost")) {
    return `https://${configured.replace(/^https?:\/\//, "")}`.replace(/\/$/, "");
  }
  return "https://earthcentric-2ug9.vercel.app";
}

export async function createCashfreeOrder(options: {
  amount: number;
  orderId: string;
  customer: { id: string; name: string; email: string; phone: string };
  returnUrl?: string;
}): Promise<CashfreeOrderSession> {
  const isMockDatabase = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");
  if (isMockDatabase && process.env.NODE_ENV === "production") {
    throw new Error("The production database is not configured for live payments.");
  }

  const instance = await getCashfreeClient();

  if (!instance) {
    throw new Error("Cashfree credentials are not configured. Please configure CASHFREE_APP_ID and CASHFREE_SECRET_KEY.");
  }

  const { client, mode } = instance;

  try {
    const baseUrl = getSecureAppUrl();
    const returnUrl = options.returnUrl && options.returnUrl.startsWith("https://")
      ? options.returnUrl
      : `${baseUrl}/checkout?order_id={order_id}`;

    // Sanitize customer_id: alphanumeric, underscores, and hyphens only (max 50 chars)
    const sanitizedCustomerId = (options.customer.id || `cust_${Date.now()}`)
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .substring(0, 50) || `cust_${Date.now()}`;

    // Sanitize customer_name: strip special characters and limit to 100 chars
    const sanitizedName = (options.customer.name || "Customer")
      .replace(/[^a-zA-Z0-9\s_-]/g, "")
      .trim()
      .substring(0, 100) || "Customer";

    // Sanitize phone: ensure 10 valid digits for Indian numbers
    const digitsOnly = (options.customer.phone || "").replace(/\D/g, "");
    const sanitizedPhone = digitsOnly.length === 10 ? digitsOnly : (digitsOnly.length > 10 ? digitsOnly.slice(-10) : "9999999999");

    const request = {
      order_amount: Math.round(options.amount * 100) / 100,
      order_currency: "INR",
      order_id: options.orderId,
      customer_details: {
        customer_id: sanitizedCustomerId,
        customer_name: sanitizedName,
        customer_email: options.customer.email || "customer@earthcentric.com",
        customer_phone: sanitizedPhone,
      },
      order_meta: {
        return_url: returnUrl
      }
    };

    // According to v6 SDK, we call instance methods without API version param first
    const response = await client.PGCreateOrder(request);
    const paymentSessionId = response.data?.payment_session_id;
    const cashfreeOrderId = response.data?.order_id;
    if (!paymentSessionId || typeof paymentSessionId !== "string" || !paymentSessionId.trim() || paymentSessionId.startsWith("mock_session_")) {
      console.error("[Cashfree] Incomplete or invalid session returned:", {
        orderId: response.data?.order_id,
        hasPaymentSessionId: Boolean(paymentSessionId),
      });
      throw new Error("Cashfree did not return a valid payment session. Check the Cashfree API response and credentials.");
    }

    // Safe diagnostic log without leaking full session ID or secrets
    console.log(`[Cashfree Order Created] orderId=${cashfreeOrderId}, env=${mode}, sessionPrefix=${paymentSessionId.slice(0, 10)}...`);

    return {
      payment_session_id: paymentSessionId,
      order_id: cashfreeOrderId || options.orderId,
      mode,
    };
  } catch (error: any) {
    const responseError = error?.response;
    const errorData = responseError?.data;
    const providerMessage = errorData?.message || error?.message || "Unknown Cashfree API error.";
    const providerCode = errorData?.code;
    console.error("[Cashfree Order Failed]", {
      orderId: options.orderId,
      message: providerMessage,
      code: providerCode,
    });
    throw new Error(`Cashfree could not create a payment session: ${providerMessage}`);
  }
}

export async function fetchCashfreeOrderPayments(orderId: string): Promise<any[]> {
  const instance = await getCashfreeClient();
  if (!instance) {
    console.warn("[Cashfree] Cannot fetch order payments: client not configured.");
    return [];
  }

  try {
    const response = await instance.client.PGOrderFetchPayments(orderId);
    return Array.isArray(response.data) ? response.data : [];
  } catch (error: any) {
    console.error("[Cashfree] Failed to fetch Cashfree payments for order:", orderId, error?.response?.data || error?.message || error);
    return [];
  }
}

export async function verifyPaymentSignature(orderId: string): Promise<boolean> {
  const payments = await fetchCashfreeOrderPayments(orderId);
  return payments.some((payment: any) => payment.payment_status === "SUCCESS");
}

export async function createCashfreeRefund(options: {
  orderId: string;
  refundId: string;
  idempotencyKey: string;
  amount: number;
  note: string;
}): Promise<CashfreeRefundResult> {
  if (!Number.isFinite(options.amount) || options.amount <= 0) {
    throw new Error("Refund amount must be greater than zero.");
  }
  if (!options.orderId || !options.refundId || !options.idempotencyKey) {
    throw new Error("Cashfree refund identifiers are required.");
  }

  const instance = await getCashfreeClient();
  const isMockDatabase = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");
  if (!instance || isMockDatabase) {
    throw new Error("Cashfree refunds are unavailable in mock mode.");
  }

  try {
    const response = await instance.client.PGOrderCreateRefund(
      options.orderId,
      {
        refund_amount: Math.round(options.amount * 100) / 100,
        refund_id: options.refundId,
        refund_note: options.note.slice(0, 80),
        refund_speed: "STANDARD",
      },
      crypto.randomUUID(),
      options.idempotencyKey
    );
    return response.data;
  } catch {
    console.error("Cashfree refund creation failed.");
    throw new Error("Cashfree could not initiate the refund. Review the payment and try again.");
  }
}

export async function fetchCashfreeRefund(
  orderId: string,
  refundId: string
): Promise<CashfreeRefundResult> {
  const instance = await getCashfreeClient();
  const isMockDatabase = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");
  if (!instance || isMockDatabase) {
    throw new Error("Cashfree refund status is unavailable in mock mode.");
  }

  try {
    const response = await instance.client.PGOrderFetchRefund(orderId, refundId);
    return response.data;
  } catch {
    console.error("Cashfree refund status lookup failed.");
    throw new Error("Cashfree could not retrieve the refund status.");
  }
}

/**
 * Cryptographically verifies incoming Cashfree webhook signature using HMAC-SHA256.
 *
 * Header requirements:
 * - x-webhook-signature: Base64-encoded HMAC-SHA256 of (timestamp + rawBody)
 * - x-webhook-timestamp: Unix timestamp when webhook was generated
 */
export async function verifyCashfreeWebhookSignature(
  signature: string | null | undefined,
  rawBody: string,
  timestamp: string | null | undefined
): Promise<boolean> {
  if (!signature || !timestamp || !rawBody) {
    return false;
  }

  const secretKey =
    (await getCredential("CASHFREE_SECRET_KEY")) ||
    process.env.CASHFREE_SECRET_KEY;

  if (!secretKey) {
    console.warn("Cashfree secret key not configured for webhook verification");
    if (process.env.NODE_ENV === "development" && signature.startsWith("mock_sig_")) {
      return true;
    }
    return false;
  }

  try {
    // 1. Try Cashfree SDK's PGVerifyWebhookSignature if available
    if (typeof (Cashfree as any)?.PGVerifyWebhookSignature === "function") {
      try {
        const verified = (Cashfree as any).PGVerifyWebhookSignature(
          signature,
          rawBody,
          timestamp
        );
        if (verified) return true;
      } catch {
        // Fallback to crypto HMAC comparison below
      }
    }

    // 2. Standard Cashfree HMAC-SHA256 verification
    const signatureData = `${timestamp}${rawBody}`;
    const computedSignature = crypto
      .createHmac("sha256", secretKey)
      .update(signatureData)
      .digest("base64");

    const computedBuffer = Buffer.from(computedSignature);
    const signatureBuffer = Buffer.from(signature);

    if (computedBuffer.length !== signatureBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(computedBuffer, signatureBuffer);
  } catch (error) {
    console.error("Error verifying Cashfree webhook signature:", error);
    return false;
  }
}
