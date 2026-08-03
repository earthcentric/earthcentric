"use server";

import db from "@/lib/db";
import { sendPayoutSettledEmail } from "@/lib/email";
import { createNotification, createAdminNotification } from "@/actions/notifications";
import { Prisma, PayoutStatus as PrismaPayoutStatus } from "@prisma/client";

export type PayoutStatus = "PENDING" | "PARTIALLY_PAID" | "APPROVED" | "REJECTED" | "PAID" | "SETTLED" | "ON_HOLD";

export interface PayoutRequestInfo {
  id: string;
  sellerId: string;
  sellerName?: string | null;
  companyName: string;
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
  rejectedReason?: string | null;
  settlementHistory?: Prisma.JsonValue;
}

export interface SellerPayoutStats {
  totalSalesRevenue: number;
  pendingAmount: number;
  settledAmount: number;
  availableBalance: number;
}

// In-memory global array for mock payouts sandbox session
let mockPayoutRequests: PayoutRequestInfo[] = [
  {
    id: "pay-req-1",
    sellerId: "seller-1-profile",
    sellerName: "Rajesh Kumar",
    companyName: "EcoThreads Apparel",
    amount: 15000,
    remainingAmount: 0,
    status: "PAID",
    requestedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
    settledAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
    paidAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
    adminEmail: "admin@earthcentric.com",
    notes: "Settled via IMPS bank transfer.",
    paymentMethod: "BANK",
    bankDetails: {
      bankName: "HDFC Bank",
      accountNumber: "501002293848",
      ifscCode: "HDFC0000123",
      accountHolderName: "Rajesh Kumar",
    },
    transactionId: "TXN9838482",
    settlementHistory: [
      {
        date: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
        amountSettled: 15000,
        transactionId: "TXN9838482",
        paymentMethod: "BANK",
        adminName: "Super Admin",
        adminNotes: "Settled via IMPS bank transfer.",
        remainingBalance: 0,
      }
    ]
  },
  {
    id: "pay-req-2",
    sellerId: "seller-1-profile",
    sellerName: "Shiva Teja",
    companyName: "EcoThreads Apparel",
    amount: 8000,
    remainingAmount: 8000,
    status: "PENDING",
    requestedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
    paymentMethod: "UPI",
    upiDetails: {
      upiId: "ecothreads@okaxis",
      accountHolderName: "Shiva Teja",
    },
    settlementHistory: []
  }
];

export async function getSellerPayoutStats(sellerId: string): Promise<SellerPayoutStats> {
  try {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      const sellerRequests = mockPayoutRequests.filter((p) => p.sellerId === sellerId);
      
      const pendingAmount = sellerRequests
        .filter((p) => p.status === "PENDING" || p.status === "PARTIALLY_PAID" || p.status === "ON_HOLD")
        .reduce((sum, p) => sum + (p.remainingAmount !== undefined && p.remainingAmount !== null ? p.remainingAmount : p.amount), 0);

      const settledAmount = sellerRequests.reduce((sum, p) => {
        if (p.status === "APPROVED" || p.status === "PAID" || p.status === "SETTLED") {
          return sum + p.amount;
        }
        if (p.status === "PARTIALLY_PAID") {
          const remaining = p.remainingAmount !== undefined && p.remainingAmount !== null ? p.remainingAmount : p.amount;
          return sum + (p.amount - remaining);
        }
        return sum;
      }, 0);
      
      const totalSalesRevenue = 156900; 
      const availableBalance = Math.max(totalSalesRevenue - (pendingAmount + settledAmount), 0);

      return {
        totalSalesRevenue,
        pendingAmount,
        settledAmount,
        availableBalance,
      };
    }

    // Resolve the actual Seller Profile database record
    const seller = await db.seller.findFirst({
      where: {
        OR: [
          { id: sellerId },
          { userId: sellerId }
        ]
      }
    });

    if (!seller) {
      return { totalSalesRevenue: 0, pendingAmount: 0, settledAmount: 0, availableBalance: 0 };
    }

    const actualSellerId = seller.id;

    // Sum of all completed order items for the seller
    const completedItems = await db.orderItem.findMany({
      where: {
        product: {
          sellerId: actualSellerId,
        },
        order: {
          payment: {
            status: "COMPLETED",
          },
        },
      },
      select: {
        price: true,
        quantity: true,
      },
    });

    const totalSalesRevenue = completedItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);

    const payouts = await db.payoutRequest.findMany({
      where: { sellerId: actualSellerId },
    });

    // Sum of payout requests that are PENDING, PARTIALLY_PAID, or ON_HOLD
    const pendingAmount = payouts
      .filter((p) => p.status === "PENDING" || p.status === "PARTIALLY_PAID" || p.status === "ON_HOLD")
      .reduce((sum, p) => sum + (p.remainingAmount !== null ? p.remainingAmount : p.amount), 0);

    // Sum of settled amounts
    const settledAmount = payouts.reduce((sum, p) => {
      if (p.status === "APPROVED" || p.status === "PAID" || p.status === "SETTLED") {
        return sum + p.amount;
      }
      if (p.status === "PARTIALLY_PAID") {
        const remaining = p.remainingAmount !== null ? p.remainingAmount : p.amount;
        return sum + (p.amount - remaining);
      }
      return sum;
    }, 0);

    // Available balance immediately deducts both pending and settled payout requests
    const availableBalance = Math.max(totalSalesRevenue - (pendingAmount + settledAmount), 0);

    return {
      totalSalesRevenue,
      pendingAmount,
      settledAmount,
      availableBalance,
    };
  } catch (error) {
    console.error("Failed to get seller payout stats, returning mock:", error);
    return {
      totalSalesRevenue: 156900,
      pendingAmount: 8000,
      settledAmount: 15000,
      availableBalance: 133900,
    };
  }
}

export async function requestPayout(
  sellerId: string,
  amount: number,
  paymentMethod: "BANK" | "UPI",
  bankDetails?: { bankName: string; accountNumber: string; ifscCode: string; accountHolderName: string } | null,
  upiDetails?: { upiId: string; accountHolderName: string } | null,
  isUrgent = false,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (amount <= 0) {
      return { success: false, error: "Withdrawal amount must be greater than zero." };
    }

    const stats = await getSellerPayoutStats(sellerId);
    if (amount > stats.availableBalance) {
      return { success: false, error: "Insufficient withdrawable balance." };
    }

    if (isUrgent && (!reason || reason.trim() === "")) {
      return { success: false, error: "Reason is required for urgent payout requests." };
    }

    if (paymentMethod === "BANK" && (!bankDetails || !bankDetails.accountNumber)) {
      return { success: false, error: "Bank account details are required." };
    }

    if (paymentMethod === "UPI" && (!upiDetails || !upiDetails.upiId)) {
      return { success: false, error: "UPI details are required." };
    }

    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      mockPayoutRequests.push({
        id: `pay-req-${Math.random().toString(36).substring(2, 9)}`,
        sellerId,
        companyName: "EcoThreads Apparel",
        amount,
        status: "PENDING",
        requestedAt: new Date(),
        isUrgent,
        reason: reason || null,
        paymentMethod,
        bankDetails: bankDetails ? (bankDetails as any) : null,
        upiDetails: upiDetails ? (upiDetails as any) : null,
      });

      return { success: true };
    }

    const seller = await db.seller.findFirst({
      where: {
        OR: [
          { id: sellerId },
          { userId: sellerId }
        ]
      }
    });

    if (!seller) {
      return { success: false, error: "Seller profile not found." };
    }

    await db.payoutRequest.create({
      data: {
        sellerId: seller.id,
        amount,
        status: "PENDING",
        isUrgent,
        reason: reason || null,
        paymentMethod,
        bankDetails: bankDetails ? (bankDetails as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        upiDetails: upiDetails ? (upiDetails as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });

    const cName = seller.companyName || "A seller";
    
    // Notify admin
    await createAdminNotification(
      "Payout Requested",
      `Seller "${cName}" has requested a payout of ₹${amount.toLocaleString()}.`,
      "payments"
    );

    // Notify seller
    await createNotification(
      seller.userId,
      "Withdrawal Request Submitted",
      `Your withdrawal request of ₹${amount.toLocaleString()} has been submitted.`,
      "/seller/dashboard?tab=payments"
    );

    return { success: true };
  } catch (error) {
    console.error("Failed to request payout:", error);
    return { success: false, error: "Failed to submit withdrawal request." };
  }
}

export async function getSellerPayoutRequests(sellerId: string): Promise<PayoutRequestInfo[]> {
  try {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      return mockPayoutRequests
        .filter((p) => p.sellerId === sellerId)
        .sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
    }

    const seller = await db.seller.findFirst({
      where: {
        OR: [
          { id: sellerId },
          { userId: sellerId }
        ]
      }
    });

    if (!seller) return [];

    const requests = await db.payoutRequest.findMany({
      where: { sellerId: seller.id },
      include: {
        seller: {
          select: { companyName: true },
        },
      },
      orderBy: {
        requestedAt: "desc",
      },
    });

    return requests.map((r) => ({
      id: r.id,
      sellerId: r.sellerId,
      companyName: r.seller.companyName,
      amount: r.amount,
      remainingAmount: r.remainingAmount !== undefined && r.remainingAmount !== null ? r.remainingAmount : r.amount,
      status: r.status as PayoutStatus,
      requestedAt: r.requestedAt,
      settledAt: r.settledAt,
      approvedAt: r.approvedAt,
      paidAt: r.paidAt,
      adminEmail: r.adminEmail,
      isUrgent: r.isUrgent,
      reason: r.reason,
      transactionId: r.transactionId,
      notes: r.notes,
      paymentMethod: r.paymentMethod,
      bankDetails: r.bankDetails ?? undefined,
      upiDetails: r.upiDetails ?? undefined,
      rejectedReason: r.rejectedReason,
      settlementHistory: r.settlementHistory ?? undefined,
    }));
  } catch (error) {
    console.error("Failed to get seller payout requests:", error);
    return [];
  }
}

export async function getAdminPayoutRequests(): Promise<PayoutRequestInfo[]> {
  try {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      return mockPayoutRequests.map(r => ({
        ...r,
        remainingAmount: r.remainingAmount !== undefined && r.remainingAmount !== null ? r.remainingAmount : r.amount,
      })).sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
    }

    const requests = await db.payoutRequest.findMany({
      include: {
        seller: {
          select: { companyName: true, ownerName: true, founderName: true },
        },
      },
      orderBy: {
        requestedAt: "desc",
      },
    });

    return requests.map((r) => ({
      id: r.id,
      sellerId: r.sellerId,
      sellerName: r.seller.ownerName || r.seller.founderName || "Seller Partner",
      companyName: r.seller.companyName || r.seller.ownerName || r.seller.founderName || "Eco Store",
      amount: r.amount,
      remainingAmount: r.remainingAmount !== undefined && r.remainingAmount !== null ? r.remainingAmount : r.amount,
      status: r.status as PayoutStatus,
      requestedAt: r.requestedAt,
      settledAt: r.settledAt,
      approvedAt: r.approvedAt,
      paidAt: r.paidAt,
      adminEmail: r.adminEmail,
      isUrgent: r.isUrgent,
      reason: r.reason,
      transactionId: r.transactionId,
      notes: r.notes,
      paymentMethod: r.paymentMethod,
      bankDetails: r.bankDetails ?? undefined,
      upiDetails: r.upiDetails ?? undefined,
      rejectedReason: r.rejectedReason,
      settlementHistory: r.settlementHistory ?? undefined,
    }));
  } catch (error) {
    console.error("Failed to get admin payout requests:", error);
    return [];
  }
}

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
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      let success = false;
      mockPayoutRequests = mockPayoutRequests.map((p) => {
        if (p.id === requestId) {
          const currentRemaining = p.remainingAmount !== undefined && p.remainingAmount !== null ? p.remainingAmount : p.amount;
          
          if (status === "REJECTED") {
            success = true;
            return { ...p, status: "REJECTED", rejectedReason };
          }
          if (status === "APPROVED") {
            success = true;
            return { ...p, status: "APPROVED", approvedAt: new Date() };
          }

          // Payment / Settlement
          const settleAmt = amountToSettle !== undefined && amountToSettle !== null ? amountToSettle : currentRemaining;
          if (settleAmt <= 0 || settleAmt > currentRemaining) return p;

          const nextRemaining = currentRemaining - settleAmt;
          const nextStatus: PayoutStatus = nextRemaining <= 0 ? "PAID" : "PARTIALLY_PAID";

          const newHistoryItem = {
            date: new Date().toISOString(),
            amountSettled: settleAmt,
            transactionId: transactionId || `TXN-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
            paymentMethod: p.paymentMethod,
            adminName: adminEmail,
            adminNotes: notes || `Settled amount of ₹${settleAmt}`,
            remainingBalance: nextRemaining,
          };

          const currentHistory = Array.isArray(p.settlementHistory) ? p.settlementHistory : [];

          success = true;
          return {
            ...p,
            status: nextStatus,
            remainingAmount: nextRemaining,
            settledAt: nextRemaining <= 0 ? new Date() : p.settledAt,
            paidAt: nextRemaining <= 0 ? new Date() : p.paidAt,
            adminEmail,
            notes: notes || p.notes,
            transactionId: transactionId || p.transactionId,
            settlementHistory: [...currentHistory, newHistoryItem],
          } as PayoutRequestInfo;
        }
        return p;
      });

      if (success) {
        const request = mockPayoutRequests.find(r => r.id === requestId);
        if (request) {
          const isReject = status === "REJECTED";
          const isApprove = status === "APPROVED";
          
          if (isApprove) {
            await createNotification(request.sellerId, "Withdrawal Approved", `Your withdrawal request of ₹${request.amount.toLocaleString()} has been approved.`, "/seller/dashboard?tab=payments");
          } else if (isReject) {
            await createNotification(request.sellerId, "Withdrawal Rejected", `Your withdrawal request of ₹${request.amount.toLocaleString()} has been rejected. Reason: ${rejectedReason || "None"}.`, "/seller/dashboard?tab=payments");
          } else {
            const history = request.settlementHistory as any[];
            const lastItem = history[history.length - 1];
            if (lastItem) {
              const { amountSettled, remainingBalance } = lastItem;
              const msg = remainingBalance <= 0 
                ? "Your payout has been completed successfully."
                : `₹${amountSettled.toLocaleString()} has been settled. ₹${remainingBalance.toLocaleString()} is still pending.`;
              
              await createNotification(request.sellerId, "Payment Sent", `You have received a payout of ₹${amountSettled.toLocaleString()}. ${msg}`, "/seller/dashboard?tab=payments");
            }
          }
        }
      }

      return success;
    }

    // Database Path
    const existingReq = await (db.payoutRequest as any).findUnique({
      where: { id: requestId },
      include: { seller: true }
    });

    if (!existingReq) return false;

    if (status === "REJECTED") {
      await (db.payoutRequest as any).update({
        where: { id: requestId },
        data: {
          status: "REJECTED",
          rejectedReason: rejectedReason || undefined,
        }
      });
      await createNotification(existingReq.seller.userId, "Withdrawal Rejected", `Your withdrawal request of ₹${existingReq.amount.toLocaleString()} has been rejected. Reason: ${rejectedReason || "None"}.`, "/seller/dashboard?tab=payments");
      return true;
    }

    if (status === "APPROVED") {
      await (db.payoutRequest as any).update({
        where: { id: requestId },
        data: {
          status: "APPROVED",
          approvedAt: new Date(),
        }
      });
      await createNotification(existingReq.seller.userId, "Withdrawal Approved", `Your withdrawal request of ₹${existingReq.amount.toLocaleString()} has been approved.`, "/seller/dashboard?tab=payments");
      return true;
    }

    // Process payout/settlement
    const currentRemaining = existingReq.remainingAmount !== null ? existingReq.remainingAmount : existingReq.amount;
    const settleAmt = amountToSettle !== undefined && amountToSettle !== null ? amountToSettle : currentRemaining;

    if (settleAmt <= 0 || settleAmt > currentRemaining) {
      console.error("Invalid settlement amount:", settleAmt);
      return false;
    }

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
    const nextHistory = [...currentHistory, newHistoryItem];

    await (db.payoutRequest as any).update({
      where: { id: requestId },
      data: {
        status: nextStatus as any,
        remainingAmount: nextRemaining,
        settledAt: nextRemaining <= 0 ? new Date() : undefined,
        paidAt: nextRemaining <= 0 ? new Date() : undefined,
        adminEmail,
        notes: notes || undefined,
        transactionId: transactionId || undefined,
        settlementHistory: nextHistory as any,
      }
    });

    // Log audit log
    await db.auditLog.create({
      data: {
        action: `SETTLE_PAYOUT_${nextStatus}`,
        adminEmail,
        details: `Settled ₹${settleAmt} of payout request ${requestId}. Remaining: ₹${nextRemaining}. Status: ${nextStatus}.`,
      }
    });

    // Send email/notification to seller
    const seller = await db.seller.findUnique({
      where: { id: existingReq.sellerId },
      include: { user: { select: { email: true, id: true } } },
    });

    const msg = nextRemaining <= 0 
      ? "Your payout has been completed successfully."
      : `₹${settleAmt.toLocaleString()} has been settled. ₹${nextRemaining.toLocaleString()} is still pending.`;

    if (seller?.user?.email) {
      await sendPayoutSettledEmail(
        seller.user.email,
        existingReq.seller.companyName,
        settleAmt,
        notes || `Payment of ₹${settleAmt.toLocaleString()}. ${msg}`
      ).catch((err) => console.error("Failed to send payout email:", err));
    }

    await createNotification(
      existingReq.seller.userId,
      "Payment Sent",
      `You have received a payout of ₹${settleAmt.toLocaleString()}. ${msg}`,
      "/seller/dashboard?tab=payments"
    );

    return true;
  } catch (error) {
    console.error("Failed to settle payout request:", error);
    return false;
  }
}
