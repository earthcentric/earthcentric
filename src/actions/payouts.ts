"use server";

import db from "@/lib/db";
import { revalidatePath } from "next/cache";
import { sendPayoutSettledEmail } from "@/lib/email";
import { createNotification, createAdminNotification } from "@/actions/notifications";
import { Prisma } from "@prisma/client";
import { getSellerFinancialStats } from "@/lib/financials";
import {
  isSellerRegistrationFeeEnabled,
  getSellerRegistrationFeeAmount,
  setSellerRegistrationFeeConfig,
  getMinimumWithdrawalAmount,
} from "@/lib/payout-config";
import {
  initiateCashfreePayoutTransfer,
  getCashfreeTransferStatus,
  isCashfreePayoutConfigured,
  maskPayoutDestination,
} from "@/lib/cashfree-payouts";
import { decrypt } from "@/lib/encryption";
import { createCashfreeOrder, verifyPaymentSignature, fetchCashfreeOrderPayments } from "@/lib/cashfree";
import { verifyAdminAuth, verifySellerAuth, verifyAuthenticatedUser } from "@/lib/auth-server";

export type PayoutStatus =
  | "PENDING"
  | "PARTIALLY_PAID"
  | "APPROVED"
  | "PROCESSING"
  | "REJECTED"
  | "PAID"
  | "SETTLED"
  | "ON_HOLD"
  | "FAILED";

export type PayoutVerificationStatus =
  | "NOT_SUBMITTED"
  | "PENDING_VERIFICATION"
  | "VERIFIED"
  | "VERIFICATION_FAILED"
  | "UPDATE_REQUIRED";

export interface PayoutRequestInfo {
  id: string;
  sellerId: string;
  sellerName?: string | null;
  companyName: string;
  sellerEmail?: string | null;
  amount: number;
  remainingAmount?: number | null;
  status: PayoutStatus;
  requestedAt: Date;
  settledAt?: Date | null;
  approvedAt?: Date | null;
  paidAt?: Date | null;
  adminEmail?: string | null;
  notes?: string | null;
  isUrgent?: boolean;
  reason?: string | null;
  transactionId?: string | null;
  paymentMethod: string;
  bankDetails?: Prisma.JsonValue;
  upiDetails?: Prisma.JsonValue;
  maskedDestination?: string;
  rejectedReason?: string | null;
  settlementHistory?: Prisma.JsonValue;
  cfTransferId?: string | null;
  cfReferenceId?: string | null;
  cfUtr?: string | null;
  cfStatus?: string | null;
  cfFailureReason?: string | null;
  initiatedAt?: Date | null;
  auditHistory?: Prisma.JsonValue;
}

export interface SellerPayoutStats {
  totalSalesRevenue: number;
  grossSalesRevenue?: number;
  cancelledRevenue?: number;
  pendingAmount: number;
  settledAmount: number;
  availableBalance: number;
  recoverableBalance?: number;
}

export interface SellerPayoutOnboardingStatus {
  sellerApproved: boolean;
  sellerStatus: string;
  feeEnabled: boolean;
  feeAmount: number;
  feePaid: boolean;
  feePaidAt?: Date | null;
  payoutVerificationStatus: PayoutVerificationStatus;
  payoutRejectionReason?: string | null;
  payoutVerifiedAt?: Date | null;
  paymentMethod: "BANK" | "UPI";
  bankAccountHolderName?: string | null;
  bankName?: string | null;
  maskedAccountNumber?: string | null;
  bankIfsc?: string | null;
  upiId?: string | null;
  upiHolderName?: string | null;
  maskedUpiId?: string | null;
  canWithdraw: boolean;
  availableBalance: number;
}

// In-memory global array for mock payouts sandbox session (when DB unavailable)
let mockPayoutRequests: PayoutRequestInfo[] = [];

// --------------------------------------------------------------------------
// 1. STATS & ONBOARDING STATUS
// --------------------------------------------------------------------------

export async function getSellerPayoutStats(sellerId: string): Promise<SellerPayoutStats> {
  try {
    const fin = await getSellerFinancialStats(sellerId);
    return {
      totalSalesRevenue: fin.sellerNetSales,
      grossSalesRevenue: fin.sellerGrossRevenue,
      cancelledRevenue: fin.sellerCancelledRevenue,
      pendingAmount: fin.pendingPayoutAmount,
      settledAmount: fin.settledPayoutAmount,
      availableBalance: fin.availableBalance,
      recoverableBalance: fin.recoverableBalance,
    };
  } catch (error) {
    console.error("Failed to get seller payout stats:", error);
    return {
      totalSalesRevenue: 0,
      grossSalesRevenue: 0,
      cancelledRevenue: 0,
      pendingAmount: 0,
      settledAmount: 0,
      availableBalance: 0,
      recoverableBalance: 0,
    };
  }
}

export async function getSellerPayoutOnboardingStatus(
  sellerIdOrUserId: string
): Promise<SellerPayoutOnboardingStatus> {
  const isMock = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");
  const feeEnabled = await isSellerRegistrationFeeEnabled();
  const feeAmount = await getSellerRegistrationFeeAmount();

  if (isMock) {
    return {
      sellerApproved: true,
      sellerStatus: "APPROVED",
      feeEnabled,
      feeAmount,
      feePaid: true,
      payoutVerificationStatus: "VERIFIED",
      paymentMethod: "BANK",
      maskedAccountNumber: "******7890",
      bankName: "HDFC Bank",
      bankAccountHolderName: "Mock Seller",
      bankIfsc: "HDFC0000123",
      canWithdraw: true,
      availableBalance: 1500,
    };
  }

  const seller = await db.seller.findFirst({
    where: {
      OR: [{ id: sellerIdOrUserId }, { userId: sellerIdOrUserId }],
    },
    include: {
      user: { select: { email: true, name: true } },
      payoutRequests: { take: 5, orderBy: { requestedAt: "desc" } },
    },
  });

  if (!seller) {
    return {
      sellerApproved: false,
      sellerStatus: "NOT_FOUND",
      feeEnabled,
      feeAmount,
      feePaid: false,
      payoutVerificationStatus: "NOT_SUBMITTED",
      paymentMethod: "BANK",
      canWithdraw: false,
      availableBalance: 0,
    };
  }

  const sellerApproved = seller.verificationStatus === "APPROVED";
  const feePaid = seller.registrationFeePaid || !feeEnabled;

  // Derive payout verification status for existing sellers
  let payoutVerificationStatus: PayoutVerificationStatus =
    (seller.payoutVerificationStatus as PayoutVerificationStatus) || "NOT_SUBMITTED";

  // If existing approved seller has bank details or past settled payout, grant verified status seamlessly
  if (payoutVerificationStatus === "NOT_SUBMITTED" && sellerApproved) {
    const hasBank = Boolean(seller.bankAccountNo && seller.bankIfsc);
    const hasUpi = Boolean(seller.upiId);
    const hasPastPayout = seller.payoutRequests.some(
      (p) => p.status === "PAID" || p.status === "SETTLED" || p.status === "APPROVED"
    );

    if (hasPastPayout || hasBank || hasUpi) {
      payoutVerificationStatus = "VERIFIED";
      // Persist the status in DB
      await db.seller.update({
        where: { id: seller.id },
        data: {
          payoutVerificationStatus: "VERIFIED",
          payoutVerifiedAt: new Date(),
          payoutVerifiedBy: "SYSTEM_LEGACY_VERIFIED",
        },
      }).catch(() => {});
    }
  }

  const fin = await getSellerPayoutStats(seller.id);
  const canWithdraw = sellerApproved && feePaid && payoutVerificationStatus === "VERIFIED" && fin.availableBalance > 0;

  const paymentMethod: "BANK" | "UPI" = seller.upiId && !seller.bankAccountNo ? "UPI" : "BANK";

  return {
    sellerApproved,
    sellerStatus: seller.verificationStatus,
    feeEnabled,
    feeAmount,
    feePaid,
    feePaidAt: seller.registrationFeePaidAt,
    payoutVerificationStatus,
    payoutRejectionReason: seller.payoutRejectionReason,
    payoutVerifiedAt: seller.payoutVerifiedAt,
    paymentMethod,
    bankAccountHolderName: seller.bankAccountHolderName || seller.ownerName || seller.user?.name || null,
    bankName: seller.bankName || null,
    maskedAccountNumber: seller.bankAccountNo ? maskPayoutDestination("BANK", seller.bankAccountNo) : null,
    bankIfsc: seller.bankIfsc || null,
    upiId: seller.upiId || null,
    upiHolderName: seller.upiHolderName || seller.ownerName || seller.user?.name || null,
    maskedUpiId: seller.upiId ? maskPayoutDestination("UPI", seller.upiId) : null,
    canWithdraw,
    availableBalance: fin.availableBalance,
  };
}

// --------------------------------------------------------------------------
// 2. SELLER REGISTRATION FEE (₹1)
// --------------------------------------------------------------------------

export async function createRegistrationFeeOrder(sellerIdOrUserId: string): Promise<{
  success: boolean;
  feeRequired?: boolean;
  alreadyPaid?: boolean;
  paymentSessionId?: string;
  orderId?: string;
  error?: string;
}> {
  try {
    const auth = await verifyAuthenticatedUser();
    if (!auth.authorized || !auth.userId) {
      return { success: false, error: "Authentication required." };
    }

    const seller = await db.seller.findFirst({
      where: { OR: [{ id: sellerIdOrUserId }, { userId: sellerIdOrUserId }] },
      include: { user: true },
    });

    if (!seller) return { success: false, error: "Seller profile not found." };

    if (auth.role !== "ADMIN" && auth.userId !== seller.userId) {
      return { success: false, error: "Unauthorized access to seller profile." };
    }

    // Must be approved first by Super Admin!
    if (seller.verificationStatus !== "APPROVED") {
      return {
        success: false,
        error: "Seller application must be reviewed and approved by Super Admin before paying the registration fee.",
      };
    }

    const feeEnabled = await isSellerRegistrationFeeEnabled();
    if (!feeEnabled) {
      return { success: true, feeRequired: false, alreadyPaid: true };
    }

    if (seller.registrationFeePaid) {
      return { success: true, feeRequired: true, alreadyPaid: true };
    }

    const amount = await getSellerRegistrationFeeAmount();
    const orderId = `SELLER-FEE-${seller.id.slice(-6).toUpperCase()}-${Date.now()}`;

    // Create Cashfree payment order session
    const customerPhone = seller.phone ? seller.phone.replace(/\D/g, "").slice(-10) : "9999999999";
    const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
    const appUrl = new URL(rawAppUrl);
    const returnUrl = new URL(`/seller/dashboard?fee_order_id=${orderId}`, appUrl).toString();

    const session = await createCashfreeOrder({
      amount,
      orderId,
      customer: {
        id: seller.userId,
        name: seller.companyName || seller.user?.name || "Seller",
        email: seller.user?.email || "seller@earthcentric.com",
        phone: customerPhone.length === 10 ? customerPhone : "9999999999",
      },
      returnUrl,
    });

    // Record in DB
    await db.sellerRegistrationPayment.create({
      data: {
        sellerId: seller.id,
        cashfreeOrderId: orderId,
        amount,
        status: "PENDING",
      },
    });

    return {
      success: true,
      feeRequired: true,
      alreadyPaid: false,
      paymentSessionId: session.payment_session_id,
      orderId,
    };
  } catch (error: any) {
    console.error("createRegistrationFeeOrder error:", error);
    return {
      success: false,
      error: error?.message || "Failed to initialize registration fee payment.",
    };
  }
}

export async function verifyRegistrationFeePayment(
  param1: string,
  param2: string
): Promise<{ success: boolean; paid?: boolean; error?: string }> {
  try {
    let orderId = param1;
    let sellerIdOrUserId = param2;

    // Detect inverted parameters defensively
    if (param1.startsWith("SELLER-FEE-") || param1.startsWith("order_")) {
      orderId = param1;
      sellerIdOrUserId = param2;
    } else if (param2.startsWith("SELLER-FEE-") || param2.startsWith("order_")) {
      orderId = param2;
      sellerIdOrUserId = param1;
    }

    const seller = await db.seller.findFirst({
      where: { OR: [{ id: sellerIdOrUserId }, { userId: sellerIdOrUserId }] },
    });
    if (!seller) return { success: false, error: "Seller profile not found." };

    if (seller.registrationFeePaid) {
      return { success: true, paid: true };
    }

    const payments = await fetchCashfreeOrderPayments(orderId);
    const successfulPayment = payments.find((p: any) => p.payment_status === "SUCCESS");
    const isVerified = Boolean(successfulPayment) || (await verifyPaymentSignature(orderId));

    if (!isVerified) {
      return { success: false, paid: false, error: "Cashfree has not confirmed this payment yet." };
    }

    const transactionId = successfulPayment?.cf_payment_id ? String(successfulPayment.cf_payment_id) : undefined;

    await db.$transaction(async (tx) => {
      await tx.sellerRegistrationPayment.updateMany({
        where: { cashfreeOrderId: orderId },
        data: {
          status: "COMPLETED",
          paidAt: new Date(),
          ...(transactionId ? { cashfreePaymentId: transactionId } : {}),
        },
      });

      await tx.seller.update({
        where: { id: seller.id },
        data: {
          registrationFeePaid: true,
          registrationFeePaidAt: new Date(),
          registrationFeeOrderId: orderId,
          ...(transactionId ? { registrationFeeTransactionId: transactionId } : {}),
        },
      });
    });

    await createNotification(
      seller.userId,
      "Registration Fee Verified ✅",
      "Your ₹1 seller registration fee has been successfully verified. You may now complete payout details.",
      "/seller/dashboard?tab=payments"
    );

    revalidatePath("/seller/dashboard");
    revalidatePath("/admin/dashboard");
    return { success: true, paid: true };
  } catch (error: any) {
    console.error("verifyRegistrationFeePayment error:", error);
    return { success: false, error: error?.message || "Failed to verify payment." };
  }
}

// --------------------------------------------------------------------------
// 3. SELLER PAYOUT PROFILE (BANK / UPI)
// --------------------------------------------------------------------------

export async function saveSellerPayoutProfile(
  arg1:
    | string
    | {
        sellerIdOrUserId: string;
        method: "BANK" | "UPI";
        accountHolderName?: string;
        bankAccountHolderName?: string;
        bankName?: string;
        accountNumber?: string;
        ifscCode?: string;
        upiId?: string;
        upiHolderName?: string;
      },
  arg2?: {
    method: "BANK" | "UPI";
    accountHolderName?: string;
    bankAccountHolderName?: string;
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
    upiId?: string;
    upiHolderName?: string;
  }
): Promise<{ success: boolean; error?: string; status?: PayoutVerificationStatus }> {
  try {
    const data =
      typeof arg1 === "string"
        ? {
            sellerIdOrUserId: arg1,
            method: arg2?.method || "BANK",
            bankAccountHolderName: arg2?.accountHolderName || arg2?.bankAccountHolderName,
            bankName: arg2?.bankName,
            accountNumber: arg2?.accountNumber,
            ifscCode: arg2?.ifscCode,
            upiId: arg2?.upiId,
            upiHolderName: arg2?.accountHolderName || arg2?.upiHolderName,
          }
        : {
            ...arg1,
            bankAccountHolderName: (arg1 as any).accountHolderName || arg1.bankAccountHolderName,
            upiHolderName: (arg1 as any).accountHolderName || arg1.upiHolderName,
          };

    const auth = await verifyAuthenticatedUser();
    if (!auth.authorized || !auth.userId) {
      return { success: false, error: "Sign in to save payout details." };
    }

    const seller = await db.seller.findFirst({
      where: { OR: [{ id: data.sellerIdOrUserId }, { userId: data.sellerIdOrUserId }] },
    });

    if (!seller) return { success: false, error: "Seller profile not found." };

    if (auth.role !== "ADMIN" && auth.userId !== seller.userId) {
      return { success: false, error: "Unauthorized access to this seller profile." };
    }

    // Super Admin application approval MUST happen first!
    if (seller.verificationStatus !== "APPROVED") {
      return {
        success: false,
        error: "Your seller application must be approved by Super Admin before setting up payout details.",
      };
    }

    // Check ₹1 registration fee if enabled
    const feeEnabled = await isSellerRegistrationFeeEnabled();
    if (feeEnabled && !seller.registrationFeePaid) {
      return {
        success: false,
        error: "Please complete the ₹1 seller registration fee before setting up payout details.",
      };
    }

    // Input validations
    if (data.method === "BANK") {
      const holderName = (data.bankAccountHolderName || "").trim();
      const bName = (data.bankName || "").trim();
      const accNo = (data.accountNumber || "").trim().replace(/\s/g, "");
      const ifsc = (data.ifscCode || "").trim().toUpperCase();

      if (holderName.length < 3) return { success: false, error: "Account holder name is required (min 3 characters)." };
      if (bName.length < 2) return { success: false, error: "Bank name is required." };
      if (!/^\d{9,18}$/.test(accNo)) return { success: false, error: "Account number must be between 9 and 18 digits." };
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) return { success: false, error: "Invalid IFSC code format (e.g. HDFC0000123)." };

      // Update in DB: reset verification status to PENDING_VERIFICATION
      await db.seller.update({
        where: { id: seller.id },
        data: {
          bankAccountHolderName: holderName,
          bankName: bName,
          bankAccountNo: accNo,
          bankIfsc: ifsc,
          upiId: null,
          upiHolderName: null,
          payoutVerificationStatus: "PENDING_VERIFICATION",
          payoutRejectionReason: null,
          payoutVerifiedAt: null,
          payoutVerifiedBy: null,
        },
      });
    } else {
      const upi = (data.upiId || "").trim().toLowerCase();
      const holderName = (data.upiHolderName || data.bankAccountHolderName || "").trim();

      if (!/^[\w.-]+@[\w.-]+$/.test(upi)) {
        return { success: false, error: "Invalid UPI ID format (e.g. user@okhdfcbank or brand@okaxis)." };
      }
      if (holderName.length < 3) {
        return { success: false, error: "Account holder name is required." };
      }

      await db.seller.update({
        where: { id: seller.id },
        data: {
          upiId: upi,
          upiHolderName: holderName,
          bankAccountHolderName: holderName,
          bankAccountNo: null,
          bankName: null,
          bankIfsc: null,
          payoutVerificationStatus: "PENDING_VERIFICATION",
          payoutRejectionReason: null,
          payoutVerifiedAt: null,
          payoutVerifiedBy: null,
        },
      });
    }

    await createAdminNotification(
      "Seller Payout Details Submitted",
      `Seller "${seller.companyName}" submitted ${data.method === "BANK" ? "bank account" : "UPI"} payout details for verification.`,
      "sellers"
    );

    await createNotification(
      seller.userId,
      "Payout Details Submitted ⏳",
      "Your payout details have been submitted. Super Admin will verify your beneficiary account before withdrawals can be initiated.",
      "/seller/dashboard?tab=payments"
    );

    revalidatePath("/seller/dashboard");
    revalidatePath("/admin/dashboard");
    return { success: true, status: "PENDING_VERIFICATION" };
  } catch (error: any) {
    console.error("saveSellerPayoutProfile error:", error);
    return { success: false, error: error?.message || "Failed to save payout profile." };
  }
}

// --------------------------------------------------------------------------
// 4. SUPER ADMIN REVIEW OF PAYOUT PROFILE
// --------------------------------------------------------------------------

export async function adminReviewPayoutProfile(
  sellerId: string,
  decision: "APPROVE" | "REJECT" | "UPDATE_REQUIRED",
  adminEmail: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await verifyAdminAuth();
  if (!auth.authorized) {
    return { success: false, error: "Super Admin authorization required." };
  }

  try {
    const seller = await db.seller.findUnique({
      where: { id: sellerId },
      include: { user: true },
    });

    if (!seller) return { success: false, error: "Seller not found." };

    if ((decision === "REJECT" || decision === "UPDATE_REQUIRED") && (!reason || reason.trim().length < 5)) {
      return { success: false, error: "A reason of at least 5 characters is required." };
    }

    const nextStatus: PayoutVerificationStatus =
      decision === "APPROVE"
        ? "VERIFIED"
        : decision === "UPDATE_REQUIRED"
        ? "UPDATE_REQUIRED"
        : "VERIFICATION_FAILED";

    await db.seller.update({
      where: { id: sellerId },
      data: {
        payoutVerificationStatus: nextStatus,
        payoutRejectionReason: decision !== "APPROVE" ? reason?.trim() : null,
        payoutVerifiedAt: decision === "APPROVE" ? new Date() : null,
        payoutVerifiedBy: adminEmail,
      },
    });

    await db.auditLog.create({
      data: {
        action: `REVIEW_PAYOUT_PROFILE_${nextStatus}`,
        adminEmail,
        details: `Super Admin ${adminEmail} marked seller ${seller.companyName} payout details as ${nextStatus}.${reason ? ` Reason: ${reason}` : ""}`,
      },
    });

    if (decision === "APPROVE") {
      await createNotification(
        seller.userId,
        "Payout Details Verified ✅",
        "Your bank/UPI payout details have been approved by Super Admin. You can now request eligible withdrawals.",
        "/seller/dashboard?tab=payments"
      );
    } else {
      await createNotification(
        seller.userId,
        "Payout Details Update Required ⚠️",
        `Your payout details could not be verified. Reason: ${reason}. Please update your details in the Payments tab.`,
        "/seller/dashboard?tab=payments"
      );
    }

    revalidatePath("/seller/dashboard");
    revalidatePath("/admin/dashboard");
    return { success: true };
  } catch (error: any) {
    console.error("adminReviewPayoutProfile error:", error);
    return { success: false, error: error?.message || "Failed to update payout profile review." };
  }
}

// --------------------------------------------------------------------------
// 5. WITHDRAWAL REQUEST (ATOMIC BALANCE RESERVATION)
// --------------------------------------------------------------------------

export async function requestPayout(
  sellerIdOrUserId: string,
  amount: number,
  paymentMethod: "BANK" | "UPI" = "BANK",
  _bankDetails?: any,
  _upiDetails?: any,
  isUrgent = false,
  reason?: string
): Promise<{ success: boolean; error?: string; requestId?: string }> {
  try {
    const auth = await verifyAuthenticatedUser();
    if (!auth.authorized || !auth.userId) {
      return { success: false, error: "Sign in to submit a withdrawal request." };
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return { success: false, error: "Withdrawal amount must be greater than zero." };
    }

    const seller = await db.seller.findFirst({
      where: { OR: [{ id: sellerIdOrUserId }, { userId: sellerIdOrUserId }] },
      include: { user: true },
    });

    if (!seller) return { success: false, error: "Seller profile not found." };

    if (auth.role !== "ADMIN" && auth.userId !== seller.userId) {
      return { success: false, error: "Unauthorized access to this seller profile." };
    }

    // 1. Seller application must be APPROVED by Super Admin
    if (seller.verificationStatus !== "APPROVED") {
      return {
        success: false,
        error: "Seller account must be approved before requesting payouts.",
      };
    }

    // 2. Registration fee must be paid if enabled
    const feeEnabled = await isSellerRegistrationFeeEnabled();
    if (feeEnabled && !seller.registrationFeePaid) {
      return {
        success: false,
        error: "Please complete the ₹1 registration fee before requesting payouts.",
      };
    }

    // 3. Payout destination must be verified
    const onboarding = await getSellerPayoutOnboardingStatus(seller.id);
    if (onboarding.payoutVerificationStatus !== "VERIFIED") {
      return {
        success: false,
        error: "Your bank/UPI payout details must be verified by Super Admin before requesting withdrawals.",
      };
    }

    // 4. Minimum withdrawal threshold check
    const minThreshold = await getMinimumWithdrawalAmount();
    if (amount < minThreshold) {
      return {
        success: false,
        error: `Minimum withdrawal amount is ₹${minThreshold}.`,
      };
    }

    if (isUrgent && (!reason || reason.trim() === "")) {
      return { success: false, error: "Reason is required for urgent payout requests." };
    }

    // 5. Atomic check & reservation inside database transaction
    const roundedAmount = Math.round(amount * 100) / 100;

    const payoutRequest = await db.$transaction(async (tx) => {
      // Re-fetch financial stats within transaction
      const fin = await getSellerFinancialStats(seller.id);
      if (roundedAmount > fin.availableBalance) {
        throw new Error(
          `Insufficient withdrawable balance. Available: ₹${fin.availableBalance.toLocaleString("en-IN")}, Requested: ₹${roundedAmount.toLocaleString("en-IN")}`
        );
      }

      // Snapshot verified destination details
      const bankSnapshot = seller.bankAccountNo
        ? {
            bankName: seller.bankName,
            accountNumber: seller.bankAccountNo,
            maskedAccountNumber: maskPayoutDestination("BANK", seller.bankAccountNo),
            ifscCode: seller.bankIfsc,
            accountHolderName: seller.bankAccountHolderName || seller.ownerName || seller.companyName,
          }
        : null;

      const upiSnapshot = seller.upiId
        ? {
            upiId: seller.upiId,
            maskedUpiId: maskPayoutDestination("UPI", seller.upiId),
            accountHolderName: seller.upiHolderName || seller.ownerName || seller.companyName,
          }
        : null;

      const record = await tx.payoutRequest.create({
        data: {
          sellerId: seller.id,
          amount: roundedAmount,
          remainingAmount: roundedAmount,
          status: "PENDING",
          isUrgent,
          reason: reason ? reason.trim() : null,
          paymentMethod: onboarding.paymentMethod,
          bankDetails: bankSnapshot ? (bankSnapshot as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
          upiDetails: upiSnapshot ? (upiSnapshot as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
          auditHistory: [
            {
              action: "REQUESTED",
              timestamp: new Date().toISOString(),
              actor: auth.email || "seller",
              amount: roundedAmount,
              details: `Seller requested withdrawal of ₹${roundedAmount}. Withdrawable balance reserved.`,
            },
          ],
        },
      });

      return record;
    });

    console.log(
      `[Payout] New withdrawal request created successfully: id=${payoutRequest.id}, sellerId=${seller.id}, companyName="${seller.companyName}", amount=₹${roundedAmount}, method=${onboarding.paymentMethod}, status=${payoutRequest.status}`
    );

    // Notify Super Admin
    await createAdminNotification(
      "New Withdrawal Request",
      `Seller "${seller.companyName}" requested a withdrawal of ₹${roundedAmount.toLocaleString("en-IN")}.`,
      "payments"
    );

    // Notify Seller
    await createNotification(
      seller.userId,
      "Withdrawal Request Submitted ⏳",
      `Your withdrawal request of ₹${roundedAmount.toLocaleString("en-IN")} has been submitted for review.`,
      "/seller/dashboard?tab=payments"
    );

    revalidatePath("/seller/dashboard");
    revalidatePath("/admin/dashboard");
    return { success: true, requestId: payoutRequest.id };
  } catch (error: any) {
    console.error("requestPayout error:", error);
    return {
      success: false,
      error: error?.message || "Failed to submit withdrawal request.",
    };
  }
}

// --------------------------------------------------------------------------
// 6. FETCH PAYOUT REQUESTS
// --------------------------------------------------------------------------

function safeSerializableJson<T>(val: T): T | undefined {
  if (val === null || val === undefined) return undefined;
  try {
    return JSON.parse(JSON.stringify(val));
  } catch {
    return undefined;
  }
}

export async function getSellerPayoutRequests(sellerIdOrUserId: string): Promise<PayoutRequestInfo[]> {
  try {
    const isMock = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");
    if (isMock) {
      return mockPayoutRequests.sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
    }

    const seller = await db.seller.findFirst({
      where: { OR: [{ id: sellerIdOrUserId }, { userId: sellerIdOrUserId }] },
    });

    if (!seller) return [];

    const requests = await db.payoutRequest.findMany({
      where: { sellerId: seller.id },
      include: {
        seller: { select: { companyName: true, ownerName: true, founderName: true } },
      },
      orderBy: { requestedAt: "desc" },
    });

    console.log(`[Payout Query] getSellerPayoutRequests for seller ${seller.id}: ${requests.length} records found.`);

    return requests.map((r) => {
      let maskedDestination = "";
      if (r.paymentMethod === "UPI") {
        const u = r.upiDetails as any;
        maskedDestination = u?.maskedUpiId || (u?.upiId ? maskPayoutDestination("UPI", u.upiId) : "UPI");
      } else {
        const b = r.bankDetails as any;
        maskedDestination = b?.maskedAccountNumber || (b?.accountNumber ? maskPayoutDestination("BANK", b.accountNumber) : "Bank");
      }

      return {
        id: r.id,
        sellerId: r.sellerId,
        companyName: r.seller?.companyName || "Eco Store",
        sellerName: r.seller?.ownerName || r.seller?.founderName || "Seller",
        amount: r.amount,
        remainingAmount: r.remainingAmount !== null ? r.remainingAmount : r.amount,
        status: (String(r.status || "PENDING").trim().toUpperCase()) as PayoutStatus,
        requestedAt: r.requestedAt ? new Date(r.requestedAt) : new Date(),
        settledAt: r.settledAt ? new Date(r.settledAt) : null,
        approvedAt: r.approvedAt ? new Date(r.approvedAt) : null,
        paidAt: r.paidAt ? new Date(r.paidAt) : null,
        adminEmail: r.adminEmail,
        isUrgent: r.isUrgent,
        reason: r.reason,
        transactionId: r.transactionId,
        notes: r.notes,
        paymentMethod: r.paymentMethod,
        maskedDestination,
        bankDetails: safeSerializableJson(r.bankDetails),
        upiDetails: safeSerializableJson(r.upiDetails),
        rejectedReason: r.rejectedReason,
        settlementHistory: safeSerializableJson(r.settlementHistory),
        cfTransferId: r.cfTransferId,
        cfReferenceId: r.cfReferenceId,
        cfUtr: r.cfUtr,
        cfStatus: r.cfStatus,
        cfFailureReason: r.cfFailureReason,
        initiatedAt: r.initiatedAt ? new Date(r.initiatedAt) : null,
        auditHistory: safeSerializableJson(r.auditHistory),
      };
    });
  } catch (error) {
    console.error("[Payout Query] getSellerPayoutRequests error:", error);
    return [];
  }
}

export async function getAdminPayoutRequests(): Promise<PayoutRequestInfo[]> {
  try {
    const isMock = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");
    if (isMock) {
      return mockPayoutRequests.sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
    }

    const requests = await db.payoutRequest.findMany({
      include: {
        seller: {
          select: {
            companyName: true,
            ownerName: true,
            founderName: true,
            payoutVerificationStatus: true,
            verificationStatus: true,
            user: { select: { email: true } },
          },
        },
      },
      orderBy: { requestedAt: "desc" },
    });

    const pendingCount = requests.filter((r) =>
      ["PENDING", "APPROVED", "PROCESSING"].includes(String(r.status || "").trim().toUpperCase())
    ).length;
    console.log(`[Payout Query] getAdminPayoutRequests returned ${requests.length} records (${pendingCount} pending/actionable)`);

    return requests.map((r) => {
      let maskedDestination = "";
      if (r.paymentMethod === "UPI") {
        const u = r.upiDetails as any;
        maskedDestination = u?.maskedUpiId || (u?.upiId ? maskPayoutDestination("UPI", u.upiId) : "UPI");
      } else {
        const b = r.bankDetails as any;
        maskedDestination = b?.maskedAccountNumber || (b?.accountNumber ? maskPayoutDestination("BANK", b.accountNumber) : "Bank");
      }

      return {
        id: r.id,
        sellerId: r.sellerId,
        companyName: r.seller?.companyName || "Eco Store",
        sellerName: r.seller?.ownerName || r.seller?.founderName || "Seller Partner",
        sellerEmail: r.seller?.user?.email || "N/A",
        amount: r.amount,
        remainingAmount: r.remainingAmount !== null ? r.remainingAmount : r.amount,
        status: (String(r.status || "PENDING").trim().toUpperCase()) as PayoutStatus,
        requestedAt: r.requestedAt ? new Date(r.requestedAt) : new Date(),
        settledAt: r.settledAt ? new Date(r.settledAt) : null,
        approvedAt: r.approvedAt ? new Date(r.approvedAt) : null,
        paidAt: r.paidAt ? new Date(r.paidAt) : null,
        adminEmail: r.adminEmail,
        isUrgent: r.isUrgent,
        reason: r.reason,
        transactionId: r.transactionId,
        notes: r.notes,
        paymentMethod: r.paymentMethod,
        maskedDestination,
        bankDetails: safeSerializableJson(r.bankDetails),
        upiDetails: safeSerializableJson(r.upiDetails),
        rejectedReason: r.rejectedReason,
        settlementHistory: safeSerializableJson(r.settlementHistory),
        cfTransferId: r.cfTransferId,
        cfReferenceId: r.cfReferenceId,
        cfUtr: r.cfUtr,
        cfStatus: r.cfStatus,
        cfFailureReason: r.cfFailureReason,
        initiatedAt: r.initiatedAt ? new Date(r.initiatedAt) : null,
        auditHistory: safeSerializableJson(r.auditHistory),
      };
    });
  } catch (error) {
    console.error("[Payout Query] getAdminPayoutRequests error:", error);
    return [];
  }
}

// --------------------------------------------------------------------------
// 7. SUPER ADMIN PAYOUT ACTIONS (APPROVE, REJECT, CASHFREE DISBURSEMENT)
// --------------------------------------------------------------------------

export async function approvePayoutRequest(
  requestId: string,
  adminEmail: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await verifyAdminAuth();
  if (!auth.authorized) return { success: false, error: "Super Admin authorization required." };

  try {
    const existing = await db.payoutRequest.findUnique({
      where: { id: requestId },
      include: { seller: true },
    });
    if (!existing || existing.status !== "PENDING") {
      return { success: false, error: "Only pending requests can be approved." };
    }

    const currentAudit = Array.isArray(existing.auditHistory) ? existing.auditHistory : [];
    const newAudit = [
      ...currentAudit,
      {
        action: "APPROVED",
        timestamp: new Date().toISOString(),
        actor: adminEmail,
        details: `Approved by ${adminEmail}.${notes ? ` Notes: ${notes}` : ""}`,
      },
    ];

    await db.payoutRequest.update({
      where: { id: requestId },
      data: {
        status: "APPROVED",
        approvedAt: new Date(),
        adminEmail,
        notes: notes || existing.notes,
        auditHistory: newAudit as any,
      },
    });

    await createNotification(
      existing.seller.userId,
      "Withdrawal Request Approved ✅",
      `Your withdrawal request of ₹${existing.amount.toLocaleString("en-IN")} has been approved by Super Admin and queued for payout.`,
      "/seller/dashboard?tab=payments"
    );

    revalidatePath("/seller/dashboard");
    revalidatePath("/admin/dashboard");
    return { success: true };
  } catch (error: any) {
    console.error("approvePayoutRequest error:", error);
    return { success: false, error: error?.message || "Failed to approve payout request." };
  }
}

export async function rejectPayoutRequest(
  requestId: string,
  adminEmail: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await verifyAdminAuth();
  if (!auth.authorized) return { success: false, error: "Super Admin authorization required." };

  if (!reason || reason.trim().length < 5) {
    return { success: false, error: "A rejection reason of at least 5 characters is required." };
  }

  try {
    const existing = await db.payoutRequest.findUnique({
      where: { id: requestId },
      include: { seller: true },
    });
    if (!existing || ["PAID", "SETTLED"].includes(existing.status)) {
      return { success: false, error: "Settled/paid payouts cannot be rejected." };
    }

    const currentAudit = Array.isArray(existing.auditHistory) ? existing.auditHistory : [];
    const newAudit = [
      ...currentAudit,
      {
        action: "REJECTED",
        timestamp: new Date().toISOString(),
        actor: adminEmail,
        details: `Rejected by ${adminEmail}. Reason: ${reason}. Reserved balance released safely.`,
      },
    ];

    await db.payoutRequest.update({
      where: { id: requestId },
      data: {
        status: "REJECTED",
        rejectedReason: reason.trim(),
        adminEmail,
        auditHistory: newAudit as any,
      },
    });

    await createNotification(
      existing.seller.userId,
      "Withdrawal Request Declined ⚠️",
      `Your withdrawal request of ₹${existing.amount.toLocaleString("en-IN")} was not approved. Reason: ${reason}. Your balance has been restored.`,
      "/seller/dashboard?tab=payments"
    );

    revalidatePath("/seller/dashboard");
    revalidatePath("/admin/dashboard");
    return { success: true };
  } catch (error: any) {
    console.error("rejectPayoutRequest error:", error);
    return { success: false, error: error?.message || "Failed to reject payout request." };
  }
}

/**
 * Super Admin initiates one-click Cashfree Payout transfer.
 */
export async function executeCashfreePayout(
  requestId: string,
  adminEmail: string
): Promise<{
  success: boolean;
  status?: PayoutStatus;
  transferId?: string;
  utr?: string;
  message?: string;
  error?: string;
}> {
  const auth = await verifyAdminAuth();
  if (!auth.authorized) return { success: false, error: "Super Admin authorization required." };

  try {
    const request = await db.payoutRequest.findUnique({
      where: { id: requestId },
      include: {
        seller: {
          include: { user: { select: { email: true, phone: true } } },
        },
      },
    });

    if (!request) return { success: false, error: "Payout request not found." };
    if (["PAID", "SETTLED"].includes(request.status)) {
      return { success: false, error: "This payout has already been paid and settled." };
    }
    if (request.status === "PROCESSING") {
      return { success: false, error: "This payout transfer is currently processing with Cashfree. Please wait for completion." };
    }

    // Validate seller is still approved and beneficiary is verified
    if (request.seller.verificationStatus !== "APPROVED") {
      return { success: false, error: "Seller application is not in APPROVED status." };
    }

    // Generate unique transferId using idempotency pattern
    const transferId = request.cfTransferId || `EC-TR-${request.id.slice(-6).toUpperCase()}-${Date.now()}`;
    const amountToTransfer = request.remainingAmount !== null ? request.remainingAmount : request.amount;

    // Transition to PROCESSING atomically
    const currentAudit = Array.isArray(request.auditHistory) ? request.auditHistory : [];
    await db.payoutRequest.update({
      where: { id: requestId },
      data: {
        status: "PROCESSING",
        cfTransferId: transferId,
        initiatedAt: new Date(),
        adminEmail,
        auditHistory: [
          ...currentAudit,
          {
            action: "DISBURSEMENT_INITIATED",
            timestamp: new Date().toISOString(),
            actor: adminEmail,
            details: `Super Admin initiated payout via Cashfree (transferId: ${transferId}, amount: ₹${amountToTransfer}).`,
          },
        ] as any,
      },
    });

    // Destination payload
    const isUpi = request.paymentMethod === "UPI";
    const upiInfo = request.upiDetails as any;
    const bankInfo = request.bankDetails as any;

    const destination = isUpi
      ? {
          transferMode: "upi" as const,
          name: upiInfo?.accountHolderName || request.seller.companyName,
          email: request.seller.user?.email || "seller@earthcentric.com",
          phone: request.seller.phone?.replace(/\D/g, "").slice(-10) || "9999999999",
          vpa: upiInfo?.upiId || request.seller.upiId,
        }
      : {
          transferMode: "banktransfer" as const,
          name: bankInfo?.accountHolderName || request.seller.companyName,
          email: request.seller.user?.email || "seller@earthcentric.com",
          phone: request.seller.phone?.replace(/\D/g, "").slice(-10) || "9999999999",
          bankAccount: bankInfo?.accountNumber || request.seller.bankAccountNo,
          ifsc: bankInfo?.ifscCode || request.seller.bankIfsc,
        };

    const result = await initiateCashfreePayoutTransfer({
      transferId,
      amount: amountToTransfer,
      destination,
      remarks: `EarthCentric Seller Payout #${request.id.slice(-6)}`,
    });

    if (result.success && result.status === "SUCCESS") {
      // Transfer succeeded immediately
      const newHistoryItem = {
        date: new Date().toISOString(),
        amountSettled: amountToTransfer,
        transactionId: result.referenceId || transferId,
        utr: result.utr,
        paymentMethod: request.paymentMethod,
        adminName: adminEmail,
        adminNotes: `Cashfree Payout Transfer Confirmed. UTR: ${result.utr || "N/A"}`,
        remainingBalance: 0,
      };

      const currentHist = Array.isArray(request.settlementHistory) ? request.settlementHistory : [];

      await db.payoutRequest.update({
        where: { id: requestId },
        data: {
          status: "PAID",
          remainingAmount: 0,
          settledAt: new Date(),
          paidAt: new Date(),
          transactionId: result.referenceId || transferId,
          cfReferenceId: result.referenceId,
          cfUtr: result.utr,
          cfStatus: "SUCCESS",
          settlementHistory: [...currentHist, newHistoryItem] as any,
          auditHistory: [
            ...currentAudit,
            {
              action: "PAID",
              timestamp: new Date().toISOString(),
              actor: "CASHFREE_PROVIDER",
              details: `Cashfree transfer succeeded. UTR: ${result.utr || "N/A"}, Ref: ${result.referenceId || transferId}.`,
            },
          ] as any,
        },
      });

      if (request.seller.user?.email) {
        await sendPayoutSettledEmail(
          request.seller.user.email,
          request.seller.companyName,
          amountToTransfer,
          `Cashfree transfer of ₹${amountToTransfer.toLocaleString("en-IN")} completed. UTR: ${result.utr || "N/A"}.`
        ).catch((e) => console.error("Payout email error:", e));
      }

      await createNotification(
        request.seller.userId,
        "Payout Disbursed Successfully 💸",
        `Your payout of ₹${amountToTransfer.toLocaleString("en-IN")} has been credited via Cashfree. UTR: ${result.utr || "See details"}.`,
        "/seller/dashboard?tab=payments"
      );

      revalidatePath("/seller/dashboard");
      revalidatePath("/admin/dashboard");
      return { success: true, status: "PAID", transferId, utr: result.utr };
    }

    if (result.success && result.status === "PENDING") {
      // Transfer accepted by Cashfree and is asynchronously processing
      await db.payoutRequest.update({
        where: { id: requestId },
        data: {
          status: "PROCESSING",
          cfReferenceId: result.referenceId,
          cfStatus: "PENDING",
          auditHistory: [
            ...currentAudit,
            {
              action: "PROCESSING",
              timestamp: new Date().toISOString(),
              actor: "CASHFREE_PROVIDER",
              details: `Cashfree payout is processing. Ref: ${result.referenceId || transferId}.`,
            },
          ] as any,
        },
      });

      revalidatePath("/seller/dashboard");
      revalidatePath("/admin/dashboard");
      return { success: true, status: "PROCESSING", transferId };
    }

    // Transfer failed
    await db.payoutRequest.update({
      where: { id: requestId },
      data: {
        status: "FAILED",
        cfStatus: "FAILED",
        cfFailureReason: result.error || "Cashfree transfer declined.",
        auditHistory: [
          ...currentAudit,
          {
            action: "FAILED",
            timestamp: new Date().toISOString(),
            actor: "CASHFREE_PROVIDER",
            details: `Cashfree transfer failed: ${result.error || "Declined by gateway"}.`,
          },
        ] as any,
      },
    });

    revalidatePath("/seller/dashboard");
    revalidatePath("/admin/dashboard");
    return { success: false, status: "FAILED", error: result.error || "Transfer failed." };
  } catch (error: any) {
    console.error("executeCashfreePayout error:", error);
    return { success: false, error: error?.message || "Failed to execute payout." };
  }
}

/**
 * Retry a failed payout after resolving failure causes.
 */
export async function retryFailedPayout(
  requestId: string,
  adminEmail: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const auth = await verifyAdminAuth();
  if (!auth.authorized) return { success: false, error: "Super Admin authorization required." };

  try {
    const request = await db.payoutRequest.findUnique({ where: { id: requestId } });
    if (!request || request.status !== "FAILED") {
      return { success: false, error: "Only failed payout requests can be retried." };
    }

    const currentAudit = Array.isArray(request.auditHistory) ? request.auditHistory : [];
    await db.payoutRequest.update({
      where: { id: requestId },
      data: {
        status: "APPROVED",
        cfFailureReason: null,
        cfStatus: null,
        auditHistory: [
          ...currentAudit,
          {
            action: "RETRY_RESET",
            timestamp: new Date().toISOString(),
            actor: adminEmail,
            details: `Super Admin ${adminEmail} reset failed payout for re-disbursement.`,
          },
        ] as any,
      },
    });

    return executeCashfreePayout(requestId, adminEmail);
  } catch (error: any) {
    return { success: false, error: error?.message || "Failed to retry payout." };
  }
}

/**
 * Reconcile status with Cashfree server.
 */
export async function reconcileCashfreePayout(
  requestId: string,
  adminEmail = "admin@earthcentric.com"
): Promise<{ success: boolean; status?: string; message?: string; error?: string }> {
  const auth = await verifyAdminAuth();
  if (!auth.authorized) return { success: false, message: "Super Admin authorization required.", error: "Super Admin authorization required." };

  try {
    const request = await db.payoutRequest.findUnique({
      where: { id: requestId },
      include: { seller: { include: { user: true } } },
    });

    if (!request || !request.cfTransferId) {
      return { success: false, message: "No Cashfree transfer ID recorded for this request." };
    }

    const res = await getCashfreeTransferStatus(request.cfTransferId);
    if (res.status === "SUCCESS" && request.status !== "PAID") {
      const amountSettled = request.remainingAmount !== null ? request.remainingAmount : request.amount;
      const newHistoryItem = {
        date: new Date().toISOString(),
        amountSettled,
        transactionId: res.referenceId || request.cfTransferId,
        utr: res.utr,
        paymentMethod: request.paymentMethod,
        adminName: adminEmail,
        adminNotes: `Reconciled via Cashfree query. UTR: ${res.utr || "N/A"}`,
        remainingBalance: 0,
      };

      const currentHist = Array.isArray(request.settlementHistory) ? request.settlementHistory : [];

      await db.payoutRequest.update({
        where: { id: requestId },
        data: {
          status: "PAID",
          remainingAmount: 0,
          settledAt: new Date(),
          paidAt: new Date(),
          cfStatus: "SUCCESS",
          cfUtr: res.utr,
          settlementHistory: [...currentHist, newHistoryItem] as any,
        },
      });

      revalidatePath("/seller/dashboard");
      revalidatePath("/admin/dashboard");
      return { success: true, status: "PAID", message: "Reconciled as PAID." };
    }

    if (res.status === "FAILED" && request.status !== "FAILED") {
      await db.payoutRequest.update({
        where: { id: requestId },
        data: {
          status: "FAILED",
          cfStatus: "FAILED",
          cfFailureReason: res.message || "Failed according to Cashfree lookup.",
        },
      });

      revalidatePath("/seller/dashboard");
      revalidatePath("/admin/dashboard");
      return { success: true, status: "FAILED", message: "Reconciled as FAILED." };
    }

    return { success: true, status: request.status, message: `Status is ${res.status}.` };
  } catch (err: any) {
    return { success: false, message: err?.message || "Reconciliation failed." };
  }
}

// --------------------------------------------------------------------------
// 8. BACKWARD-COMPATIBLE MANUAL SETTLEMENT (FOR EXISTING ADMIN CALLS)
// --------------------------------------------------------------------------

export async function settlePayoutRequest(
  requestId: string,
  adminEmail: string,
  notes?: string,
  transactionId?: string,
  status: PayoutStatus = "PAID",
  rejectedReason?: string,
  amountToSettle?: number
): Promise<boolean> {
  try {
    if (status === "REJECTED") {
      const res = await rejectPayoutRequest(requestId, adminEmail, rejectedReason || "Administrative rejection.");
      return res.success;
    }
    if (status === "APPROVED") {
      const res = await approvePayoutRequest(requestId, adminEmail, notes);
      return res.success;
    }

    const existingReq = await db.payoutRequest.findUnique({
      where: { id: requestId },
      include: { seller: { include: { user: true } } },
    });
    if (!existingReq) return false;

    const currentRemaining =
      existingReq.remainingAmount !== null ? existingReq.remainingAmount : existingReq.amount;
    const settleAmt =
      amountToSettle !== undefined && amountToSettle !== null ? amountToSettle : currentRemaining;

    if (settleAmt <= 0 || settleAmt > currentRemaining) return false;

    const nextRemaining = currentRemaining - settleAmt;
    const nextStatus: PayoutStatus = nextRemaining <= 0 ? "PAID" : "PARTIALLY_PAID";

    const newHistoryItem = {
      date: new Date().toISOString(),
      amountSettled: settleAmt,
      transactionId: transactionId || `TXN-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
      paymentMethod: existingReq.paymentMethod,
      adminName: adminEmail,
      adminNotes: notes || `Settled amount of ₹${settleAmt}`,
      remainingBalance: nextRemaining,
    };

    const currentHistory = Array.isArray(existingReq.settlementHistory) ? existingReq.settlementHistory : [];

    await db.payoutRequest.update({
      where: { id: requestId },
      data: {
        status: nextStatus,
        remainingAmount: nextRemaining,
        settledAt: nextRemaining <= 0 ? new Date() : undefined,
        paidAt: nextRemaining <= 0 ? new Date() : undefined,
        adminEmail,
        notes: notes || undefined,
        transactionId: transactionId || undefined,
        settlementHistory: [...currentHistory, newHistoryItem] as any,
      },
    });

    if (existingReq.seller.user?.email) {
      await sendPayoutSettledEmail(
        existingReq.seller.user.email,
        existingReq.seller.companyName,
        settleAmt,
        notes || `Payment of ₹${settleAmt.toLocaleString("en-IN")}.`
      ).catch(() => {});
    }

    await createNotification(
      existingReq.seller.userId,
      "Payment Sent 💸",
      `You have received a payout of ₹${settleAmt.toLocaleString("en-IN")}.`,
      "/seller/dashboard?tab=payments"
    );

    revalidatePath("/seller/dashboard");
    revalidatePath("/admin/dashboard");
    return true;
  } catch (error) {
    console.error("settlePayoutRequest error:", error);
    return false;
  }
}

// --------------------------------------------------------------------------
// 9. SUPER ADMIN SELLER ONBOARDING & BENEFICIARY PROFILES
// --------------------------------------------------------------------------

export interface SellerOnboardingProfile {
  sellerId: string;
  userId: string;
  companyName: string;
  sellerName: string;
  sellerEmail: string;
  sellerPhone?: string;
  applicationStatus: string;
  activationStatus: "RESTRICTED" | "PAYMENT_REQUIRED" | "ACTIVE";
  registrationFeeEnabled: boolean;
  registrationFeeAmount: number;
  registrationFeePaid: boolean;
  registrationFeePaidAt?: string | null;
  registrationFeeTransactionId?: string | null;
  payoutVerificationStatus: string;
  payoutRejectionReason?: string | null;
  payoutVerifiedAt?: string | null;
  payoutVerifiedBy?: string | null;
  maskedBankNumber?: string | null;
  bankIfsc?: string | null;
  bankName?: string | null;
  bankAccountHolderName?: string | null;
  maskedUpiId?: string | null;
  upiHolderName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getAdminSellerOnboardingProfiles(): Promise<SellerOnboardingProfile[]> {
  try {
    const adminAuth = await verifyAdminAuth();
    if (!adminAuth.authorized) {
      throw new Error("Unauthorized: Super Admin access required.");
    }
    const feeEnabled = await isSellerRegistrationFeeEnabled();
    const feeAmount = await getSellerRegistrationFeeAmount();
    const sellers = await db.seller.findMany({
      include: { user: true },
      orderBy: { updatedAt: "desc" },
    });

    return sellers.map((s) => {
      let rawBank: string | null = s.bankAccountNo;
      try {
        if (rawBank && (rawBank.includes(":") || rawBank.length > 28)) {
          const dec = decrypt(rawBank);
          if (dec) rawBank = dec;
        }
      } catch (_) {}

      let activationStatus: "RESTRICTED" | "PAYMENT_REQUIRED" | "ACTIVE" = "RESTRICTED";
      if (s.verificationStatus === "APPROVED") {
        if (feeEnabled && !s.registrationFeePaid) {
          activationStatus = "PAYMENT_REQUIRED";
        } else {
          activationStatus = "ACTIVE";
        }
      }

      return {
        sellerId: s.id,
        userId: s.userId,
        companyName: s.companyName,
        sellerName: s.user?.name || s.companyName,
        sellerEmail: s.user?.email || "",
        sellerPhone: s.phone || s.user?.phone || undefined,
        applicationStatus: s.verificationStatus,
        activationStatus,
        registrationFeeEnabled: feeEnabled,
        registrationFeeAmount: feeAmount,
        registrationFeePaid: s.registrationFeePaid,
        registrationFeePaidAt: s.registrationFeePaidAt?.toISOString() || null,
        registrationFeeTransactionId: s.registrationFeeTransactionId || null,
        payoutVerificationStatus: s.payoutVerificationStatus || "NOT_SUBMITTED",
        payoutRejectionReason: s.payoutRejectionReason || null,
        payoutVerifiedAt: s.payoutVerifiedAt?.toISOString() || null,
        payoutVerifiedBy: s.payoutVerifiedBy || null,
        maskedBankNumber: rawBank ? maskPayoutDestination(rawBank) : null,
        bankIfsc: s.bankIfsc || null,
        bankName: s.bankName || null,
        bankAccountHolderName: s.bankAccountHolderName || null,
        maskedUpiId: s.upiId ? maskPayoutDestination(s.upiId) : null,
        upiHolderName: s.upiHolderName || null,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      };
    });
  } catch (err) {
    console.error("getAdminSellerOnboardingProfiles error:", err);
    return [];
  }
}

export async function updateAdminRegistrationFeeConfig(enabled: boolean, amount = 1.0) {
  const adminAuth = await verifyAdminAuth();
  if (!adminAuth.authorized) {
    return { success: false, error: "Unauthorized: Super Admin access required." };
  }
  const res = await setSellerRegistrationFeeConfig({ enabled, amount });
  revalidatePath("/admin/dashboard");
  revalidatePath("/seller/dashboard");
  return res;
}

export async function getAdminRegistrationFeeConfig() {
  const [enabled, amount] = await Promise.all([
    isSellerRegistrationFeeEnabled(),
    getSellerRegistrationFeeAmount(),
  ]);
  return { enabled, amount };
}

