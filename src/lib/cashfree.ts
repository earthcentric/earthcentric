import { Cashfree, CFEnvironment } from "cashfree-pg";
import { getCredential } from "./credentials";
import crypto from "crypto";

export type CashfreeMode = "SANDBOX" | "PRODUCTION" | "MOCK";

export interface CashfreeOrderSession {
  order_id: string;
  payment_session_id: string;
  mode: CashfreeMode;
}

let cashfreeClient: Cashfree | null = null;

export function getCashfreeMode(): Exclude<CashfreeMode, "MOCK"> {
  const env = (process.env.CASHFREE_ENVIRONMENT || "SANDBOX").toUpperCase();
  if (env !== "SANDBOX" && env !== "PRODUCTION") {
    throw new Error("CASHFREE_ENVIRONMENT must be SANDBOX or PRODUCTION.");
  }
  return env;
}

export async function isCashfreeConfigured(): Promise<boolean> {
  const appId = await getCredential("CASHFREE_APP_ID");
  const secretKey = await getCredential("CASHFREE_SECRET_KEY");
  return !!appId && !!secretKey;
}

export async function getCashfreeClient(): Promise<Cashfree | null> {
  if (cashfreeClient) return cashfreeClient;

  const appId = await getCredential("CASHFREE_APP_ID") || process.env.CASHFREE_APP_ID;
  const secretKey = await getCredential("CASHFREE_SECRET_KEY") || process.env.CASHFREE_SECRET_KEY;
  const mode = getCashfreeMode();

  if (!appId || !secretKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Cashfree credentials are not configured in the production environment.");
    }
    return null;
  }

  const environment = mode === "PRODUCTION" ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX;
  cashfreeClient = new Cashfree(environment, appId, secretKey);
  return cashfreeClient;
}

export async function createCashfreeOrder(options: {
  amount: number;
  orderId: string;
  customer: { id: string; name: string; email: string; phone: string };
}): Promise<CashfreeOrderSession> {
  const mode = getCashfreeMode();
  const isMockDatabase = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");
  if (isMockDatabase && process.env.NODE_ENV === "production") {
    throw new Error("The production database is not configured for live payments.");
  }

  const client = await getCashfreeClient();

  if (!client || isMockDatabase) {
    return {
      payment_session_id: `mock_session_${Math.random().toString(36).substring(2, 9)}`,
      order_id: `order_mock_${options.orderId}`,
      mode: "MOCK",
    };
  }

  try {
    const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const appUrl = new URL(rawAppUrl);
    if (process.env.NODE_ENV === "production" && appUrl.protocol !== "https:") {
      throw new Error("NEXT_PUBLIC_APP_URL must use HTTPS in production.");
    }

    const returnUrl = new URL("/checkout?order_id={order_id}", appUrl).toString();

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
    const paymentSessionId = response.data.payment_session_id;
    const cashfreeOrderId = response.data.order_id;
    if (!paymentSessionId || !cashfreeOrderId) {
      console.error("Cashfree created an incomplete order response:", {
        orderId: response.data.order_id,
        hasPaymentSessionId: Boolean(paymentSessionId),
      });
      throw new Error("Cashfree did not return a payment session. Check the Cashfree API response and credentials.");
    }
    return {
      payment_session_id: paymentSessionId,
      order_id: cashfreeOrderId,
      mode,
    };
  } catch (error) {
    const responseError =
      typeof error === "object" && error !== null && "response" in error
        ? error.response
        : undefined;
    const errorData =
      typeof responseError === "object" &&
      responseError !== null &&
      "data" in responseError
        ? responseError.data
        : undefined;
    const providerMessage =
      typeof errorData === "object" &&
      errorData !== null &&
      "message" in errorData &&
      typeof errorData.message === "string"
        ? errorData.message
        : error instanceof Error
          ? error.message
          : "Unknown Cashfree API error.";
    console.error("Cashfree order creation failed:", {
      message: providerMessage,
      code:
        typeof errorData === "object" &&
        errorData !== null &&
        "code" in errorData
          ? errorData.code
          : undefined,
    });
    throw new Error(`Cashfree could not create a payment session: ${providerMessage}`);
  }
}

export async function verifyPaymentSignature(orderId: string): Promise<boolean> {
  const client = await getCashfreeClient();
  
  const isMock =
    process.env.NODE_ENV !== "production" &&
    (!client || !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock"));
  if (isMock || orderId.startsWith("order_mock_")) return true;

  try {
    const response = await client!.PGOrderFetchPayments(orderId);
    
    // Check if any payment is successful
    const payments = response.data;
    if (Array.isArray(payments)) {
       return payments.some((payment: any) => payment.payment_status === "SUCCESS");
    }
    return false;
  } catch (error: any) {
    console.error("Failed to verify Cashfree payment:", error?.response?.data || error);
    return false;
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
