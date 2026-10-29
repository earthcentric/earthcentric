import db from "@/lib/db";

export const MARKETPLACE_COMMISSION_RATE = 0.10; // 10% sustainable marketplace commission

export interface PlatformFinancialStats {
  grossOrderValue: number;
  netSales: number;
  totalRefundsAmount: number;
  marketplaceCommission: number;
  sellerPayableBalance: number;
  totalActiveOrders: number;
  totalCancelledOrders: number;
  totalRefundedOrders: number;
  pendingCancellationCount: number;
  approvedCancellationCount: number;
  rejectedCancellationCount: number;
  refundsProcessingCount: number;
  refundsCompletedCount: number;
  refundsFailedCount: number;
}

export interface SellerFinancialStats {
  sellerGrossRevenue: number;
  sellerCancelledRevenue: number;
  sellerNetSales: number;
  marketplaceCommission: number;
  sellerNetEarnings: number;
  pendingPayoutAmount: number;
  settledPayoutAmount: number;
  availableBalance: number;
  recoverableBalance: number;
  activeOrdersCount: number;
  cancelledOrdersCount: number;
}

/**
 * Builds date range filter condition from dashboard filter inputs
 */
export function buildDateFilter(
  filterType?: "overall" | "daily" | "monthly" | "yearly",
  selectedDate?: string,
  selectedMonth?: string,
  selectedYear?: string
) {
  if (filterType === "daily" && selectedDate) {
    const start = new Date(selectedDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(selectedDate);
    end.setHours(23, 59, 59, 999);
    return { gte: start, lte: end };
  } else if (filterType === "monthly" && selectedMonth) {
    const [year, month] = selectedMonth.split("-").map(Number);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    return { gte: start, lte: end };
  } else if (filterType === "yearly" && selectedYear) {
    const year = Number(selectedYear);
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59, 999);
    return { gte: start, lte: end };
  }
  return undefined;
}

/**
 * Shared backend financial calculation for Super Admin Portal
 */
export async function getPlatformFinancialStats(params?: {
  filterType?: "overall" | "daily" | "monthly" | "yearly";
  selectedDate?: string;
  selectedMonth?: string;
  selectedYear?: string;
}): Promise<PlatformFinancialStats> {
  const isMock = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");
  if (isMock) {
    return {
      grossOrderValue: 325450,
      netSales: 289450,
      totalRefundsAmount: 36000,
      marketplaceCommission: 28945,
      sellerPayableBalance: 260505,
      totalActiveOrders: 58,
      totalCancelledOrders: 3,
      totalRefundedOrders: 3,
      pendingCancellationCount: 2,
      approvedCancellationCount: 4,
      rejectedCancellationCount: 1,
      refundsProcessingCount: 1,
      refundsCompletedCount: 3,
      refundsFailedCount: 0,
    };
  }

  const dateRange = buildDateFilter(params?.filterType, params?.selectedDate, params?.selectedMonth, params?.selectedYear);
  const whereCreatedAt = dateRange ? { createdAt: dateRange } : {};
  const whereRequestedAt = dateRange ? { requestedAt: dateRange } : {};

  // Fetch all orders with payment COMPLETED
  const orders = await db.order.findMany({
    where: {
      ...whereCreatedAt,
      payment: { is: { status: "COMPLETED" } },
    },
    include: {
      payment: true,
      cancellations: true,
    },
  });

  let grossOrderValue = 0;
  let netSales = 0;
  let totalActiveOrders = 0;
  let totalCancelledOrders = 0;
  let totalRefundedOrders = 0;

  for (const o of orders) {
    const amount = o.totalAmount || o.payment?.amount || 0;
    grossOrderValue += amount;

    const approvedCancellation = o.cancellations?.find((c) => c.status === "APPROVED");

    if (o.status === "CANCELLED") {
      totalCancelledOrders++;
    } else if (o.status === "REFUNDED" || o.status === "RETURNED") {
      totalRefundedOrders++;
    } else if (approvedCancellation) {
      totalCancelledOrders++;
      const refundAmt = approvedCancellation.refundAmount ?? amount;
      const remainingNet = Math.max(0, amount - refundAmt);
      netSales += remainingNet;
      if (remainingNet > 0) totalActiveOrders++;
    } else {
      // Active order
      totalActiveOrders++;
      netSales += amount;
    }
  }

  // Fetch cancellation records
  const cancellations = await db.orderCancellation.findMany({
    where: whereRequestedAt,
    select: {
      status: true,
      refundStatus: true,
      refundAmount: true,
    },
  });

  let pendingCancellationCount = 0;
  let approvedCancellationCount = 0;
  let rejectedCancellationCount = 0;
  let refundsProcessingCount = 0;
  let refundsCompletedCount = 0;
  let refundsFailedCount = 0;
  let totalRefundsAmount = 0;

  for (const c of cancellations) {
    if (c.status === "REQUESTED") pendingCancellationCount++;
    if (c.status === "APPROVED") approvedCancellationCount++;
    if (c.status === "REJECTED") rejectedCancellationCount++;

    if (c.refundStatus === "PENDING" || c.refundStatus === "PENDING_PAYMENT") refundsProcessingCount++;
    if (c.refundStatus === "SUCCESS") {
      refundsCompletedCount++;
      totalRefundsAmount += (c.refundAmount || 0);
    }
    if (c.refundStatus === "FAILED") refundsFailedCount++;
  }

  // If order was marked REFUNDED but cancellation record didn't sum up, fallback
  if (totalRefundsAmount === 0 && totalRefundedOrders > 0) {
    totalRefundsAmount = orders
      .filter((o) => o.status === "REFUNDED")
      .reduce((sum, o) => sum + o.totalAmount, 0);
  }

  const marketplaceCommission = Math.round(netSales * MARKETPLACE_COMMISSION_RATE * 100) / 100;
  const sellerPayableBalance = Math.round((netSales - marketplaceCommission) * 100) / 100;

  return {
    grossOrderValue: Math.round(grossOrderValue * 100) / 100,
    netSales: Math.round(netSales * 100) / 100,
    totalRefundsAmount: Math.round(totalRefundsAmount * 100) / 100,
    marketplaceCommission,
    sellerPayableBalance,
    totalActiveOrders,
    totalCancelledOrders,
    totalRefundedOrders,
    pendingCancellationCount,
    approvedCancellationCount,
    rejectedCancellationCount,
    refundsProcessingCount,
    refundsCompletedCount,
    refundsFailedCount,
  };
}

/**
 * Shared backend financial calculation for Seller Dashboard and Payouts
 */
export async function getSellerFinancialStats(
  sellerIdOrUserId: string,
  params?: {
    filterType?: "overall" | "daily" | "monthly" | "yearly";
    selectedDate?: string;
    selectedMonth?: string;
    selectedYear?: string;
  }
): Promise<SellerFinancialStats> {
  const isMock = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");
  if (isMock) {
    const sellerGrossRevenue = 175000;
    const sellerCancelledRevenue = 18100;
    const sellerNetSales = sellerGrossRevenue - sellerCancelledRevenue;
    const marketplaceCommission = Math.round(sellerNetSales * MARKETPLACE_COMMISSION_RATE);
    const sellerNetEarnings = sellerNetSales - marketplaceCommission;
    const pendingPayoutAmount = 8000;
    const settledPayoutAmount = 15000;
    const availableBalance = Math.max(sellerNetEarnings - (pendingPayoutAmount + settledPayoutAmount), 0);
    const recoverableBalance = Math.max((pendingPayoutAmount + settledPayoutAmount) - sellerNetEarnings, 0);

    return {
      sellerGrossRevenue,
      sellerCancelledRevenue,
      sellerNetSales,
      marketplaceCommission,
      sellerNetEarnings,
      pendingPayoutAmount,
      settledPayoutAmount,
      availableBalance,
      recoverableBalance,
      activeOrdersCount: 14,
      cancelledOrdersCount: 2,
    };
  }

  // Resolve actual seller ID
  const seller = await db.seller.findFirst({
    where: {
      OR: [{ id: sellerIdOrUserId }, { userId: sellerIdOrUserId }],
    },
  });

  if (!seller) {
    return {
      sellerGrossRevenue: 0,
      sellerCancelledRevenue: 0,
      sellerNetSales: 0,
      marketplaceCommission: 0,
      sellerNetEarnings: 0,
      pendingPayoutAmount: 0,
      settledPayoutAmount: 0,
      availableBalance: 0,
      recoverableBalance: 0,
      activeOrdersCount: 0,
      cancelledOrdersCount: 0,
    };
  }

  const actualSellerId = seller.id;
  const dateRange = buildDateFilter(params?.filterType, params?.selectedDate, params?.selectedMonth, params?.selectedYear);
  const whereDate = dateRange ? { createdAt: dateRange } : {};

  // Fetch all order items for this seller where order payment is COMPLETED
  const items = await db.orderItem.findMany({
    where: {
      product: { sellerId: actualSellerId },
      order: {
        ...whereDate,
        payment: { is: { status: "COMPLETED" } },
      },
    },
    include: {
      order: {
        select: {
          id: true,
          status: true,
          createdAt: true,
          cancellations: {
            where: { status: "APPROVED" },
            select: { id: true, refundAmount: true, snapshotItems: true },
          },
        },
      },
    },
  });

  let sellerGrossRevenue = 0;
  let sellerCancelledRevenue = 0;
  let sellerNetSales = 0;
  const activeOrderIds = new Set<string>();
  const cancelledOrderIds = new Set<string>();

  for (const it of items) {
    const itemTotal = it.price * it.quantity;
    sellerGrossRevenue += itemTotal;

    const approvedCancellation = it.order.cancellations?.[0];
    let isItemReturnedOrCancelled = false;

    if (it.order.status === "CANCELLED" || it.order.status === "REFUNDED" || it.order.status === "RETURNED") {
      isItemReturnedOrCancelled = true;
    } else if (approvedCancellation) {
      const snapshots = (approvedCancellation.snapshotItems as any[]) || [];
      if (snapshots.length === 0 || snapshots.some((s: any) => s.productId === it.productId)) {
        isItemReturnedOrCancelled = true;
      }
    }

    if (isItemReturnedOrCancelled) {
      sellerCancelledRevenue += itemTotal;
      cancelledOrderIds.add(it.order.id);
    } else {
      sellerNetSales += itemTotal;
      activeOrderIds.add(it.order.id);
    }
  }

  // Calculate marketplace commission & seller payable balance
  const marketplaceCommission = Math.round(sellerNetSales * MARKETPLACE_COMMISSION_RATE * 100) / 100;
  const sellerNetEarnings = Math.round((sellerNetSales - marketplaceCommission) * 100) / 100;

  // Payout requests
  const payouts = await db.payoutRequest.findMany({
    where: { sellerId: actualSellerId },
  });

  const pendingPayoutAmount = payouts
    .filter((p) => p.status === "PENDING" || p.status === "PARTIALLY_PAID" || p.status === "ON_HOLD")
    .reduce((sum, p) => sum + (p.remainingAmount !== null ? p.remainingAmount : p.amount), 0);

  const settledPayoutAmount = payouts.reduce((sum, p) => {
    if (p.status === "APPROVED" || p.status === "PAID" || p.status === "SETTLED") {
      return sum + p.amount;
    }
    if (p.status === "PARTIALLY_PAID") {
      const remaining = p.remainingAmount !== null ? p.remainingAmount : p.amount;
      return sum + (p.amount - remaining);
    }
    return sum;
  }, 0);

  const availableBalance = Math.max(sellerNetEarnings - (pendingPayoutAmount + settledPayoutAmount), 0);
  const recoverableBalance = Math.max((pendingPayoutAmount + settledPayoutAmount) - sellerNetEarnings, 0);

  return {
    sellerGrossRevenue: Math.round(sellerGrossRevenue * 100) / 100,
    sellerCancelledRevenue: Math.round(sellerCancelledRevenue * 100) / 100,
    sellerNetSales: Math.round(sellerNetSales * 100) / 100,
    marketplaceCommission,
    sellerNetEarnings,
    pendingPayoutAmount: Math.round(pendingPayoutAmount * 100) / 100,
    settledPayoutAmount: Math.round(settledPayoutAmount * 100) / 100,
    availableBalance: Math.round(availableBalance * 100) / 100,
    recoverableBalance: Math.round(recoverableBalance * 100) / 100,
    activeOrdersCount: activeOrderIds.size,
    cancelledOrdersCount: cancelledOrderIds.size,
  };
}
