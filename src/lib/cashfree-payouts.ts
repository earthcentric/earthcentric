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
 * Returns whether Cashfree Payouts credentials are configured.
 */
export async function isCashfreePayoutConfigured(): Promise<boolean> {
  const clientId =
    (await getCredential("CASHFREE_PAYOUT_CLIENT_ID")) ||
    (await getCredential("CF_PAYOUT_CLIENT_ID")) ||
    process.env.CASHFREE_PAYOUT_CLIENT_ID ||
    process.env.CF_PAYOUT_CLIENT_ID;

  const clientSecret =
    (await getCredential("CASHFREE_PAYOUT_CLIENT_SECRET")) ||
    (await getCredential("CF_PAYOUT_CLIENT_SECRET")) ||
    process.env.CASHFREE_PAYOUT_CLIENT_SECRET ||
    process.env.CF_PAYOUT_CLIENT_SECRET;

  return Boolean(clientId && clientSecret);
}

/**
 * Get Cashfree Payouts base URL.
 */
function getPayoutBaseUrl(): string {
  const env = (process.env.CASHFREE_ENVIRONMENT || "SANDBOX").toUpperCase();
  return env === "PRODUCTION"
    ? "https://payout-api.cashfree.com/payout/v1"
    : "https://sandbox.cashfree.com/payout/v1";
}

/**
 * Obtain Cashfree Payout Bearer Token from `/authorize`.
 */
async function getCashfreePayoutToken(): Promise<string | null> {
  const clientId =
    (await getCredential("CASHFREE_PAYOUT_CLIENT_ID")) ||
    (await getCredential("CF_PAYOUT_CLIENT_ID")) ||
    process.env.CASHFREE_PAYOUT_CLIENT_ID ||
    process.env.CF_PAYOUT_CLIENT_ID;

  const clientSecret =
    (await getCredential("CASHFREE_PAYOUT_CLIENT_SECRET")) ||
    (await getCredential("CF_PAYOUT_CLIENT_SECRET")) ||
    process.env.CASHFREE_PAYOUT_CLIENT_SECRET ||
    process.env.CF_PAYOUT_CLIENT_SECRET;

  if (!clientId || !clientSecret) return null;

  try {
    const res = await fetch(`${getPayoutBaseUrl()}/authorize`, {
      method: "POST",
      headers: {
        "X-Client-Id": clientId,
        "X-Client-Secret": clientSecret,
        "Content-Type": "application/json",
      },
    });

    const data = await res.json();
    if (data.status === "SUCCESS" && data.data?.token) {
      return data.data.token;
    }
    console.error("Cashfree payout authorization response:", data);
    return null;
  } catch (error) {
    console.error("Cashfree payout authorization failed:", error);
    return null;
  }
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

  if (!isConfigured) {
    // Check if running in Cashfree sandbox test mode where test transfers are permitted
    const isSandboxTestMode = process.env.CASHFREE_ENVIRONMENT === "SANDBOX" && process.env.NODE_ENV !== "production";
    if (isSandboxTestMode && process.env.ALLOW_SANDBOX_MOCK_PAYOUTS === "true") {
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

  const token = await getCashfreePayoutToken();
  if (!token) {
    return {
      success: false,
      status: "FAILED",
      transferId: options.transferId,
      error: "Failed to authenticate with Cashfree Payouts API. Check payout client credentials.",
    };
  }

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

  const token = await getCashfreePayoutToken();
  if (!token) {
    return { status: "UNKNOWN", error: "Could not authenticate with Cashfree Payouts." };
  }

  try {
    const res = await fetch(`${getPayoutBaseUrl()}/getTransferStatus?transferId=${encodeURIComponent(transferId)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
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
