import crypto from "crypto";
import { getCredential } from "./credentials";

export interface CashfreePayoutDestination {
  transferMode: "banktransfer" | "upi";
  name: string;
  email: string;
  phone: string;
  bankAccount?: string;
  ifsc?: string;
  vpa?: string;
}

export interface CashfreePayoutResult {
  success: boolean;
  status: "SUCCESS" | "PENDING" | "FAILED";
  transferId: string;
  referenceId?: string;
  utr?: string;
  message?: string;
  error?: string;
  rawResponse?: any;
}

/**
 * Helper to resolve the Cashfree Payout Client ID following the precedence rule:
 * 1. Database-backed SystemCredential
 * 2. Server Environment Variable
 */
export async function getPayoutClientId(): Promise<string> {
  const dbVal = await getCredential("CASHFREE_PAYOUT_CLIENT_ID");
  if (dbVal && dbVal.trim() !== "") return dbVal.trim();
  const cfVal = await getCredential("CF_PAYOUT_CLIENT_ID");
  if (cfVal && cfVal.trim() !== "") return cfVal.trim();
  const envVal = process.env.CASHFREE_PAYOUT_CLIENT_ID || process.env.CF_PAYOUT_CLIENT_ID;
  return envVal && envVal.trim() !== "" ? envVal.trim() : "";
}

/**
 * Helper to resolve the Cashfree Payout Client Secret following the precedence rule:
 * 1. Database-backed SystemCredential
 * 2. Server Environment Variable
 * Never exposed to frontend or logged.
 */
export async function getPayoutClientSecret(): Promise<string> {
  const dbVal = await getCredential("CASHFREE_PAYOUT_CLIENT_SECRET");
  if (dbVal && dbVal.trim() !== "") return dbVal.trim();
  const cfVal = await getCredential("CF_PAYOUT_CLIENT_SECRET");
  if (cfVal && cfVal.trim() !== "") return cfVal.trim();
  const envVal = process.env.CASHFREE_PAYOUT_CLIENT_SECRET || process.env.CF_PAYOUT_CLIENT_SECRET;
  return envVal && envVal.trim() !== "" ? envVal.trim() : "";
}

/**
 * Determine the intended Cashfree Payout environment.
 * Auto-detects sandbox keys to prevent misrouting sandbox credentials to production.
 */
export async function getPayoutEnvironment(): Promise<"SANDBOX" | "PRODUCTION"> {
  const clientId = await getPayoutClientId();
  const clientSecret = await getPayoutClientSecret();

  // If credentials clearly belong to test/sandbox, enforce sandbox
  const isExplicitTestKey =
    clientId.toLowerCase().includes("test") ||
    clientId.toLowerCase().includes("sandbox") ||
    clientSecret.toLowerCase().includes("test") ||
    clientSecret.toLowerCase().includes("sandbox");

  if (isExplicitTestKey) {
    return "SANDBOX";
  }

  const rawEnv =
    (await getCredential("CASHFREE_PAYOUT_ENV")) ||
    (await getCredential("CASHFREE_ENVIRONMENT")) ||
    process.env.CASHFREE_PAYOUT_ENV ||
    process.env.CASHFREE_ENVIRONMENT ||
    "SANDBOX";

  return rawEnv.trim().toUpperCase() === "PRODUCTION" ? "PRODUCTION" : "SANDBOX";
}

/**
 * Get Cashfree Payouts base URL.
 */
export async function getPayoutBaseUrl(): Promise<string> {
  const env = await getPayoutEnvironment();
  return env === "PRODUCTION"
    ? "https://payout-api.cashfree.com/payout/v1"
    : "https://sandbox.cashfree.com/payout/v1";
}

/**
 * Returns whether Cashfree Payouts credentials are configured.
 */
export async function isCashfreePayoutConfigured(): Promise<boolean> {
  const clientId = await getPayoutClientId();
  const clientSecret = await getPayoutClientSecret();
  return Boolean(clientId && clientSecret);
}

/**
 * Obtain Cashfree Payout Bearer Token from `/authorize`.
 * Returns token or detailed diagnostic error without leaking secret.
 */
export async function getCashfreePayoutToken(): Promise<{
  token?: string;
  error?: string;
  subCode?: string;
}> {
  const clientId = await getPayoutClientId();
  const clientSecret = await getPayoutClientSecret();
  const baseUrl = await getPayoutBaseUrl();
  const env = await getPayoutEnvironment();

  if (!clientId || !clientSecret) {
    return {
      error: "Cashfree Payouts credentials are not configured. Please set CASHFREE_PAYOUT_CLIENT_ID and CASHFREE_PAYOUT_CLIENT_SECRET.",
    };
  }

  try {
    const res = await fetch(`${baseUrl}/authorize`, {
      method: "POST",
      headers: {
        "X-Client-Id": clientId,
        "X-Client-Secret": clientSecret,
        "Content-Type": "application/json",
      },
    });

    const data = await res.json().catch(() => null);

    if (res.ok && data?.status === "SUCCESS" && data?.data?.token) {
      console.log(`[Cashfree Payout] Token authorized successfully (env=${env}, expiry=${data.data.expiry || "N/A"}).`);
      return { token: data.data.token };
    }

    const errorMsg = data?.message || `Cashfree authorization failed with HTTP ${res.status}`;
    console.error("[Cashfree Payout] Authorization error:", {
      status: data?.status,
      subCode: data?.subCode,
      message: errorMsg,
      env,
    });

    return {
      error: errorMsg,
      subCode: data?.subCode ? String(data.subCode) : undefined,
    };
  } catch (error: any) {
    console.error("[Cashfree Payout] Authorization network error:", error?.message || error);
    return {
      error: error?.message || "Network error contacting Cashfree Payouts API.",
    };
  }
}

/**
 * Validate Cashfree Payouts configuration and connection safely without financial transfers.
 */
export async function validateCashfreePayoutConfig(): Promise<{
  configured: boolean;
  environment: "SANDBOX" | "PRODUCTION";
  hasClientId: boolean;
  hasClientSecret: boolean;
  authenticated?: boolean;
  message?: string;
  error?: string;
}> {
  const clientId = await getPayoutClientId();
  const clientSecret = await getPayoutClientSecret();
  const env = await getPayoutEnvironment();

  if (!clientId || !clientSecret) {
    const missing: string[] = [];
    if (!clientId) missing.push("CASHFREE_PAYOUT_CLIENT_ID");
    if (!clientSecret) missing.push("CASHFREE_PAYOUT_CLIENT_SECRET");
    return {
      configured: false,
      environment: env,
      hasClientId: Boolean(clientId),
      hasClientSecret: Boolean(clientSecret),
      error: `Missing configuration: ${missing.join(", ")}. Please configure them in System Settings (Credentials Manager) or server environment variables.`,
    };
  }

  const auth = await getCashfreePayoutToken();
  if (auth.token) {
    return {
      configured: true,
      environment: env,
      hasClientId: true,
      hasClientSecret: true,
      authenticated: true,
      message: `Cashfree Payouts API connection verified successfully in ${env} mode.`,
    };
  }

  return {
    configured: true,
    environment: env,
    hasClientId: true,
    hasClientSecret: true,
    authenticated: false,
    error: `Authentication failed in ${env} mode: ${auth.error || "Invalid Client ID or Secret"}.`,
  };
}

/**
 * Initiate an atomic payout transfer via Cashfree Direct Transfer API.
 */
export async function initiateCashfreePayoutTransfer(options: {
  transferId: string;
  amount: number;
  destination: CashfreePayoutDestination;
  remarks?: string;
}): Promise<CashfreePayoutResult> {
  const isConfigured = await isCashfreePayoutConfigured();
  const env = await getPayoutEnvironment();

  if (!isConfigured) {
    // Check if running in offline mock database mode
    const isMockDatabase = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");
    if (isMockDatabase && process.env.ALLOW_SANDBOX_MOCK_PAYOUTS === "true") {
      const mockRef = `CF-SIM-${Date.now()}`;
      const mockUtr = `UTR-${Math.floor(100000000000 + Math.random() * 900000000000)}`;
      return {
        success: true,
        status: "SUCCESS",
        transferId: options.transferId,
        referenceId: mockRef,
        utr: mockUtr,
        message: "Sandbox test transfer completed.",
      };
    }

    return {
      success: false,
      status: "FAILED",
      transferId: options.transferId,
      error: "Cashfree Payouts API is not configured. Please configure CASHFREE_PAYOUT_CLIENT_ID and CASHFREE_PAYOUT_CLIENT_SECRET in System Settings or environment variables.",
    };
  }

  const auth = await getCashfreePayoutToken();
  if (!auth.token) {
    return {
      success: false,
      status: "FAILED",
      transferId: options.transferId,
      error: `Cashfree Payouts authorization failed (${env}): ${auth.error || "Invalid credentials"}.`,
    };
  }

  const baseUrl = await getPayoutBaseUrl();
  const token = auth.token;

  try {
    const payload: any = {
      maxReturn: 1,
      transferId: options.transferId,
      transferMode: options.destination.transferMode,
      transferAmount: Math.round(options.amount * 100) / 100,
      remarks: (options.remarks || `Payout ${options.transferId}`).slice(0, 70),
      beneDetails: {
        name: options.destination.name,
        email: options.destination.email,
        phone: options.destination.phone,
        address1: "India",
      },
    };

    if (options.destination.transferMode === "banktransfer") {
      payload.beneDetails.bankAccount = options.destination.bankAccount;
      payload.beneDetails.ifsc = options.destination.ifsc;
    } else {
      payload.beneDetails.vpa = options.destination.vpa;
    }

    const res = await fetch(`${getPayoutBaseUrl()}/requestTransfer`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    console.log("[Cashfree Payout] Transfer request response:", data);

    if (data.status === "SUCCESS") {
      const transferData = data.data || {};
      const statusStr = (transferData.status || "").toUpperCase();

      if (statusStr === "SUCCESS") {
        return {
          success: true,
          status: "SUCCESS",
          transferId: options.transferId,
          referenceId: transferData.referenceId ? String(transferData.referenceId) : undefined,
          utr: transferData.utr ? String(transferData.utr) : undefined,
          message: data.message || "Payout processed successfully.",
          rawResponse: data,
        };
      }

      // If pending or received, it is currently processing
      return {
        success: true,
        status: "PENDING",
        transferId: options.transferId,
        referenceId: transferData.referenceId ? String(transferData.referenceId) : undefined,
        utr: transferData.utr ? String(transferData.utr) : undefined,
        message: data.message || "Payout request received and processing.",
        rawResponse: data,
      };
    }

    // Failed or rejected
    return {
      success: false,
      status: "FAILED",
      transferId: options.transferId,
      error: data.message || "Cashfree declined the payout transfer request.",
      rawResponse: data,
    };
  } catch (err: any) {
    console.error("Cashfree payout request network error:", err);
    return {
      success: false,
      status: "FAILED",
      transferId: options.transferId,
      error: err?.message || "Network error contacting Cashfree Payouts API.",
    };
  }
}

/**
 * Check transfer status on Cashfree server.
 */
export async function getCashfreeTransferStatus(transferId: string): Promise<{
  status: "SUCCESS" | "PENDING" | "FAILED" | "UNKNOWN";
  referenceId?: string;
  utr?: string;
  message?: string;
  error?: string;
}> {
  const isConfigured = await isCashfreePayoutConfigured();
  if (!isConfigured) {
    return { status: "UNKNOWN", error: "Cashfree Payouts is not configured." };
  }

  const auth = await getCashfreePayoutToken();
  if (!auth.token) {
    return { status: "UNKNOWN", error: auth.error || "Could not authenticate with Cashfree Payouts." };
  }

  try {
    const baseUrl = await getPayoutBaseUrl();
    const res = await fetch(`${baseUrl}/getTransferStatus?transferId=${encodeURIComponent(transferId)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${auth.token}`,
        "Content-Type": "application/json",
      },
    });

    const data = await res.json();
    if (data.status === "SUCCESS") {
      const transferData = data.data?.transfer || data.data || {};
      const statusStr = (transferData.status || "").toUpperCase();

      if (statusStr === "SUCCESS") {
        return {
          status: "SUCCESS",
          referenceId: transferData.referenceId ? String(transferData.referenceId) : undefined,
          utr: transferData.utr ? String(transferData.utr) : undefined,
          message: data.message,
        };
      }
      if (statusStr === "FAILED" || statusStr === "REJECTED" || statusStr === "CANCELLED") {
        return {
          status: "FAILED",
          referenceId: transferData.referenceId ? String(transferData.referenceId) : undefined,
          message: transferData.statusDescription || data.message || "Transfer failed.",
        };
      }
      return {
        status: "PENDING",
        referenceId: transferData.referenceId ? String(transferData.referenceId) : undefined,
        message: "Transfer is currently processing.",
      };
    }

    return {
      status: "UNKNOWN",
      error: data.message || "Could not retrieve status.",
    };
  } catch (err: any) {
    return { status: "UNKNOWN", error: err?.message || "Network error." };
  }
}

/**
 * Mask sensitive bank account number or UPI ID for display.
 * Example: 1234567890 -> ******7890
 * Example: rajesh@okaxis -> r***@okaxis
 */
export function maskPayoutDestination(arg1: string, arg2?: string): string {
  const value = arg2 !== undefined ? arg2 : arg1;
  const method = arg2 !== undefined ? arg1 : (value.includes("@") ? "UPI" : "BANK");
  if (!value) return "Not provided";
  const trimmed = value.trim();
  if (method === "UPI" || trimmed.includes("@")) {
    const parts = trimmed.split("@");
    if (parts.length === 2) {
      const name = parts[0];
      const maskedName = name.length <= 2 ? `${name[0]}*` : `${name[0]}***${name.slice(-1)}`;
      return `${maskedName}@${parts[1]}`;
    }
  }
  // Bank Account
  if (trimmed.length <= 4) return `****${trimmed}`;
  return `******${trimmed.slice(-4)}`;
}
