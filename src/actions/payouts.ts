"use server";

import db from "@/lib/db";
import { sendPayoutSettledEmail } from "@/lib/email";
import { createNotification, createAdminNotification } from "@/actions/notifications";

export type PayoutStatus = "PENDING" | "SETTLED" | "REJECTED";

export interface PayoutRequestInfo {
  id: string;
  sellerId: string;
  companyName: string;
  amount: number;
  status: PayoutStatus;
  requestedAt: Date;
  settledAt?: Date | null;
  adminEmail?: string | null;
  notes?: string | null;
  isUrgent?: boolean;
  reason?: string | null;
  transactionId?: string | null;
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
    companyName: "EcoThreads Apparel",
    amount: 15000,
    status: "SETTLED",
    requestedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
    settledAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
    adminEmail: "admin@earthcentric.com",
    notes: "Settled via IMPS bank transfer.",
  },
  {
    id: "pay-req-2",
    sellerId: "seller-1-profile",
    companyName: "EcoThreads Apparel",
    amount: 8000,
    status: "PENDING",
    requestedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
  }
];

export async function getSellerPayoutStats(sellerId: string): Promise<SellerPayoutStats> {
  try {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      const sellerRequests = mockPayoutRequests.filter((p) => p.sellerId === sellerId);
      const pendingAmount = sellerRequests
        .filter((p) => p.status === "PENDING")
        .reduce((sum, p) => sum + p.amount, 0);
      const settledAmount = sellerRequests
        .filter((p) => p.status === "SETTLED")
        .reduce((sum, p) => sum + p.amount, 0);
      const totalSalesRevenue = 156900; // Match default mock stats revenue
      const availableBalance = Math.max(totalSalesRevenue - (pendingAmount + settledAmount), 0);

      return {
        totalSalesRevenue,
        pendingAmount,
        settledAmount,
        availableBalance,
      };
    }

    // Dynamic database lookup
    const completedItems = await db.orderItem.findMany({
      where: {
        product: {
          sellerId: sellerId,
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
      where: { sellerId },
    });

    const pendingAmount = payouts
      .filter((p) => p.status === "PENDING")
      .reduce((sum, p) => sum + p.amount, 0);

    const settledAmount = payouts
      .filter((p) => p.status === "SETTLED")
      .reduce((sum, p) => sum + p.amount, 0);

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

function getCurrentCycleRange(): { start: Date; end: Date } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const date = now.getDate();

  if (date <= 15) {
    return {
      start: new Date(year, month, 1, 0, 0, 0, 0),
      end: new Date(year, month, 15, 23, 59, 59, 999),
    };
  } else {
    return {
      start: new Date(year, month, 16, 0, 0, 0, 0),
      end: new Date(year, month + 1, 0, 23, 59, 59, 999),
    };
  }
}

export async function requestPayout(
  sellerId: string,
  amount: number,
  isUrgent = false,
  reason?: string,
  paymentMethod?: string,
  paymentDetails?: string
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

    const cycle = getCurrentCycleRange();
    const formattedNotes = paymentMethod && paymentDetails ? `[${paymentMethod}] ${paymentDetails}` : null;

    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      if (!isUrgent) {
        const recentNormalRequests = mockPayoutRequests.filter(
          (p) => p.sellerId === sellerId && !p.isUrgent && p.requestedAt >= cycle.start && p.requestedAt <= cycle.end
        );

        if (recentNormalRequests.length >= 1) {
          return {
            success: false,
            error: "Payout limit reached for this cycle. You can only request one normal payout per cycle (1st–15th and 16th–end of month).",
          };
        }
      }

      mockPayoutRequests.push({
        id: `pay-req-${Math.random().toString(36).substring(2, 9)}`,
        sellerId,
        companyName: "EcoThreads Apparel",
        amount,
        status: "PENDING",
        requestedAt: new Date(),
        isUrgent,
        reason: reason || null,
        notes: formattedNotes,
      });

      return { success: true };
    }

    if (!isUrgent) {
      const normalRequestCount = await db.payoutRequest.count({
        where: {
          sellerId,
          isUrgent: false,
          requestedAt: {
            gte: cycle.start,
            lte: cycle.end,
          },
        },
      });

      if (normalRequestCount >= 1) {
        return {
          success: false,
          error: "Payout limit reached for this cycle. You can only request one normal payout per cycle (1st–15th and 16th–end of month).",
        };
      }
    }

    await db.payoutRequest.create({
      data: {
        sellerId,
        amount,
        status: "PENDING",
        isUrgent,
        reason: reason || null,
        notes: formattedNotes,
      },
    });
    const sProfile = await db.seller.findFirst({
      where: {
        OR: [{ id: sellerId }, { userId: sellerId }]
      }
    });
    const cName = sProfile?.companyName || "A seller";
    await createAdminNotification(
      "Payout Requested",
      `Seller "${cName}" has requested a payout of ₹${amount}.`,
      "payments"
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

    const requests = await db.payoutRequest.findMany({
      where: { sellerId },
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
      status: r.status as PayoutStatus,
      requestedAt: r.requestedAt,
      settledAt: r.settledAt,
      adminEmail: r.adminEmail,
      isUrgent: r.isUrgent,
      reason: r.reason,
      transactionId: r.transactionId,
      notes: r.notes,
    }));
  } catch (error) {
    console.error("Failed to get seller payout requests:", error);
    return [];
  }
}

export async function getAdminPayoutRequests(): Promise<PayoutRequestInfo[]> {
  try {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      return mockPayoutRequests.sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
    }

    const requests = await db.payoutRequest.findMany({
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
      status: r.status as PayoutStatus,
      requestedAt: r.requestedAt,
      settledAt: r.settledAt,
      adminEmail: r.adminEmail,
      isUrgent: r.isUrgent,
      reason: r.reason,
      transactionId: r.transactionId,
      notes: r.notes,
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
  status: "SETTLED" | "REJECTED" | "APPROVED" | "ON_HOLD" = "SETTLED"
): Promise<boolean> {
  try {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      mockPayoutRequests = mockPayoutRequests.map((p) => {
        if (p.id === requestId) {
          return {
            ...p,
            status: status as any,
            settledAt: status === "SETTLED" ? new Date() : p.settledAt,
            adminEmail,
            notes: notes || `Updated in demo mode. Status: ${status}`,
            transactionId: transactionId || p.transactionId,
          };
        }
        return p;
      });

      const settled = mockPayoutRequests.find((p) => p.id === requestId);
      if (settled && status === "SETTLED") {
        await sendPayoutSettledEmail(
          "seller@earthcentric.com",
          settled.companyName,
          settled.amount,
          notes
        ).catch((err) => console.error("Failed to send payout email:", err));
      }
      return true;
    }

    const request = await db.payoutRequest.update({
      where: { id: requestId },
      data: {
        status: status as any,
        settledAt: status === "SETTLED" ? new Date() : undefined,
        adminEmail,
        notes,
        transactionId,
      },
      include: {
        seller: { select: { companyName: true } },
      },
    });

    // Log to Audit Log
    await db.auditLog.create({
      data: {
        action: `SETTLE_PAYOUT_${status}`,
        adminEmail,
        details: `Updated payout request status to ${status} for ₹${request.amount} for seller ${request.seller.companyName} (${request.sellerId}). TxId: ${transactionId || "None"}. Notes: ${notes || "None"}`,
      },
    });

    // Send payout settled email to seller if settled
    if (status === "SETTLED") {
      const seller = await db.seller.findUnique({
        where: { id: request.sellerId },
        include: { user: { select: { email: true, id: true } } },
      });
      if (seller?.user?.email) {
        await sendPayoutSettledEmail(
          seller.user.email,
          request.seller.companyName,
          request.amount,
          notes
        ).catch((err) => console.error("Failed to send payout email:", err));
      }
      if (seller?.user?.id) {
        await createNotification(seller.user.id, "Payout Settled", `Your payout of ₹${request.amount.toLocaleString()} has been settled.`, "/seller/dashboard");
      }
    }

    return true;
  } catch (error) {
    console.error("Failed to settle payout request:", error);
    return false;
  }
}
