"use server";

import db from "@/lib/db";
import { verifyWorkerAuth } from "@/lib/auth-server";
import { getAbandonmentThresholdMinutes } from "@/actions/checkout-tracking";

export interface WorkerOverviewStats {
  totalBuyers: number;
  totalSellers: number;
  newRegistrationsToday: number;
  totalAbandonedCheckouts: number;
  pendingFollowUps: number;
  completedFollowUps: number;
  recentActivity: Array<{
    id: string;
    type: "BUYER_REGISTRATION" | "SELLER_REGISTRATION" | "ABANDONED_CHECKOUT";
    title: string;
    description: string;
    timestamp: Date;
    statusBadge?: string;
  }>;
}

export interface WorkerBuyerItem {
  id: string;
  name: string;
  email: string;
  mobileNumber: string | null;
  registrationDate: Date;
  profileStatus: "COMPLETED" | "PROFILE_PENDING" | "MOBILE_PENDING";
  latestFeedback?: {
    callStatus: string;
    feedbackNotes?: string | null;
    nextFollowUpDate?: Date | null;
    lastContactedAt?: Date | null;
  } | null;
}

export interface WorkerSellerItem {
  id: string;
  userId: string;
  companyName: string;
  ownerName: string | null;
  email: string;
  mobileNumber: string | null;
  businessType: string;
  registrationDate: Date;
  verificationStatus: string;
  latestFeedback?: {
    callStatus: string;
    feedbackNotes?: string | null;
    nextFollowUpDate?: Date | null;
    lastContactedAt?: Date | null;
  } | null;
}

export interface WorkerAbandonedCheckoutItem {
  id: string;
  checkoutRequestId?: string | null;
  userId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  checkoutStartedAt: Date;
  lastAttemptAt: Date;
  attemptCount: number;
  checkoutStatus: string;
  paymentStatus: string;
  totalCartValue: number;
  products: Array<{
    productId: string;
    name: string;
    imageUrl?: string;
    price: number;
    quantity: number;
  }>;
  feedbackCallStatus?: string | null;
  feedbackNotes?: string | null;
  abandonmentReason?: string | null;
  lastWorkerContactAt?: Date | null;
}

/**
 * Super Admin or Worker auth guard helper.
 */
async function requireWorker() {
  const auth = await verifyWorkerAuth();
  if (!auth.authorized || !auth.userId || !auth.email) {
    throw new Error("Unauthorized: Worker access required.");
  }
  return auth;
}

/**
 * 3. Overview Dashboard Statistics
 */
export async function getWorkerOverviewStats(): Promise<{
  success: boolean;
  stats?: WorkerOverviewStats;
  error?: string;
}> {
  try {
    await requireWorker();

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const thresholdMinutes = await getAbandonmentThresholdMinutes();
    const thresholdDate = new Date(Date.now() - thresholdMinutes * 60 * 1000);

    const [
      totalBuyers,
      totalSellers,
      newBuyersToday,
      newSellersToday,
      abandonedCheckoutsCount,
      pendingFollowupsCount,
      completedFollowupsCount,
      recentBuyers,
      recentSellers,
      recentAbandoned,
    ] = await Promise.all([
      db.user.count({ where: { role: "BUYER" } }),
      db.seller.count(),
      db.user.count({ where: { role: "BUYER", createdAt: { gte: startOfToday } } }),
      db.seller.count({ where: { createdAt: { gte: startOfToday } } }),
      db.abandonedCheckout.count({
        where: {
          paymentStatus: { not: "COMPLETED" },
          resolvedAt: null,
          checkoutStartedAt: { lte: thresholdDate },
        },
      }),
      db.customerFeedback.count({
        where: {
          callStatus: { in: ["PENDING", "CALLBACK_REQUESTED", "NOT_ANSWERED", "UNREACHABLE"] },
        },
      }),
      db.customerFeedback.count({
        where: {
          callStatus: { in: ["CALLED", "FEEDBACK_RECEIVED"] },
        },
      }),
      db.user.findMany({
        where: { role: "BUYER" },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, name: true, email: true, createdAt: true },
      }),
      db.seller.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, companyName: true, createdAt: true, user: { select: { email: true } } },
      }),
      db.abandonedCheckout.findMany({
        where: {
          paymentStatus: { not: "COMPLETED" },
          resolvedAt: null,
          checkoutStartedAt: { lte: thresholdDate },
        },
        orderBy: { checkoutStartedAt: "desc" },
        take: 5,
        include: { user: { select: { name: true, email: true } } },
      }),
    ]);

    const activity: WorkerOverviewStats["recentActivity"] = [];

    for (const b of recentBuyers) {
      activity.push({
        id: `buyer-${b.id}`,
        type: "BUYER_REGISTRATION",
        title: `New Buyer: ${b.name || b.email}`,
        description: `Registered with ${b.email}`,
        timestamp: b.createdAt,
        statusBadge: "New Buyer",
      });
    }

    for (const s of recentSellers) {
      activity.push({
        id: `seller-${s.id}`,
        type: "SELLER_REGISTRATION",
        title: `New Seller: ${s.companyName}`,
        description: `Application received from ${s.user.email}`,
        timestamp: s.createdAt,
        statusBadge: "New Seller",
      });
    }

    for (const a of recentAbandoned) {
      activity.push({
        id: `checkout-${a.id}`,
        type: "ABANDONED_CHECKOUT",
        title: `Abandoned Checkout: ₹${a.totalAmount.toLocaleString()}`,
        description: `${a.user.name || a.user.email} initiated checkout without completing payment`,
        timestamp: a.checkoutStartedAt,
        statusBadge: "Unpaid",
      });
    }

    // Sort combined activity descending
    activity.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return {
      success: true,
      stats: {
        totalBuyers,
        totalSellers,
        newRegistrationsToday: newBuyersToday + newSellersToday,
        totalAbandonedCheckouts: abandonedCheckoutsCount,
        pendingFollowUps: pendingFollowupsCount,
        completedFollowUps: completedFollowupsCount,
        recentActivity: activity.slice(0, 10),
      },
    };
  } catch (error: any) {
    console.error("getWorkerOverviewStats error:", error);
    return { success: false, error: error?.message || "Failed to load overview statistics." };
  }
}

/**
 * 4. New Buyers Section - Searchable, Filterable, and Sortable
 */
export async function getWorkerBuyers(params?: {
  search?: string;
  startDate?: string;
  endDate?: string;
  sortOrder?: "desc" | "asc";
}): Promise<{
  success: boolean;
  buyers?: WorkerBuyerItem[];
  error?: string;
}> {
  try {
    await requireWorker();

    const search = params?.search?.trim();
    const sortOrder = params?.sortOrder === "asc" ? "asc" : "desc";

    const where: any = {
      role: "BUYER",
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { mobileNumber: { contains: search, mode: "insensitive" } },
      ];
    }

    if (params?.startDate || params?.endDate) {
      where.createdAt = {};
      if (params.startDate) where.createdAt.gte = new Date(params.startDate);
      if (params.endDate) {
        const end = new Date(params.endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const buyers = await db.user.findMany({
      where,
      orderBy: { createdAt: sortOrder },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        mobileNumber: true,
        mobileNumberCountryCode: true,
        mobileNumberSubmitted: true,
        buyerOnboardingCompleted: true,
        createdAt: true,
      },
      take: 200,
    });

    // Fetch latest feedback for these buyers
    const buyerIds = buyers.map((b) => b.id);
    const feedbacks = await db.customerFeedback.findMany({
      where: {
        customerId: { in: buyerIds },
        customerType: "BUYER",
      },
      orderBy: { createdAt: "desc" },
    });

    const feedbackMap = new Map<string, any>();
    for (const fb of feedbacks) {
      if (!feedbackMap.has(fb.customerId)) {
        feedbackMap.set(fb.customerId, fb);
      }
    }

    const items: WorkerBuyerItem[] = buyers.map((b) => {
      const fb = feedbackMap.get(b.id);
      let profileStatus: WorkerBuyerItem["profileStatus"] = "MOBILE_PENDING";
      if (b.buyerOnboardingCompleted) {
        profileStatus = "COMPLETED";
      } else if (b.mobileNumberSubmitted) {
        profileStatus = "PROFILE_PENDING";
      }

      const formattedPhone = b.mobileNumber
        ? `${b.mobileNumberCountryCode || "+91"} ${b.mobileNumber}`
        : b.phone || null;

      return {
        id: b.id,
        name: b.name || "EarthCentric Buyer",
        email: b.email,
        mobileNumber: formattedPhone,
        registrationDate: b.createdAt,
        profileStatus,
        latestFeedback: fb
          ? {
              callStatus: fb.callStatus,
              feedbackNotes: fb.feedbackNotes,
              nextFollowUpDate: fb.nextFollowUpDate,
              lastContactedAt: fb.lastContactedAt || fb.createdAt,
            }
          : null,
      };
    });

    return { success: true, buyers: items };
  } catch (error: any) {
    console.error("getWorkerBuyers error:", error);
    return { success: false, error: error?.message || "Failed to load buyers." };
  }
}

/**
 * Get single buyer full details for worker modal view
 */
export async function getWorkerBuyerDetails(buyerId: string) {
  try {
    await requireWorker();

    const buyer = await db.user.findUnique({
      where: { id: buyerId },
      include: {
        addresses: {
          where: { NOT: { street: { startsWith: "[Deleted]" } } },
        },
        orders: {
          select: {
            id: true,
            totalAmount: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    if (!buyer) {
      return { success: false, error: "Buyer not found." };
    }

    const feedbackHistory = await db.customerFeedback.findMany({
      where: { customerId: buyerId, customerType: "BUYER" },
      orderBy: { createdAt: "desc" },
    });

    return {
      success: true,
      buyer: {
        id: buyer.id,
        name: buyer.name || "EarthCentric Buyer",
        email: buyer.email,
        phone: buyer.phone,
        mobileNumber: buyer.mobileNumber,
        mobileNumberCountryCode: buyer.mobileNumberCountryCode,
        buyerOnboardingCompleted: buyer.buyerOnboardingCompleted,
        buyerVerifiedAt: buyer.buyerVerifiedAt,
        gstStatus: buyer.gstStatus,
        gstin: buyer.gstin,
        createdAt: buyer.createdAt,
        addresses: buyer.addresses,
        recentOrders: buyer.orders,
        feedbackHistory,
      },
    };
  } catch (error: any) {
    console.error("getWorkerBuyerDetails error:", error);
    return { success: false, error: error?.message || "Failed to load buyer details." };
  }
}

/**
 * 5. New Sellers Section - Searchable, Filterable, and Sortable
 */
export async function getWorkerSellers(params?: {
  search?: string;
  startDate?: string;
  endDate?: string;
  sortOrder?: "desc" | "asc";
}): Promise<{
  success: boolean;
  sellers?: WorkerSellerItem[];
  error?: string;
}> {
  try {
    await requireWorker();

    const search = params?.search?.trim();
    const sortOrder = params?.sortOrder === "asc" ? "asc" : "desc";

    const where: any = {};

    if (search) {
      where.OR = [
        { companyName: { contains: search, mode: "insensitive" } },
        { ownerName: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { user: { email: { contains: search, mode: "insensitive" } } },
        { user: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    if (params?.startDate || params?.endDate) {
      where.createdAt = {};
      if (params.startDate) where.createdAt.gte = new Date(params.startDate);
      if (params.endDate) {
        const end = new Date(params.endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const sellers = await db.seller.findMany({
      where,
      orderBy: { createdAt: sortOrder },
      select: {
        id: true,
        userId: true,
        companyName: true,
        ownerName: true,
        phone: true,
        businessType: true,
        verificationStatus: true,
        createdAt: true,
        user: {
          select: {
            email: true,
            name: true,
            mobileNumber: true,
            mobileNumberCountryCode: true,
          },
        },
      },
      take: 200,
    });

    const sellerIds = sellers.map((s) => s.id);
    const feedbacks = await db.customerFeedback.findMany({
      where: {
        customerId: { in: sellerIds },
        customerType: "SELLER",
      },
      orderBy: { createdAt: "desc" },
    });

    const feedbackMap = new Map<string, any>();
    for (const fb of feedbacks) {
      if (!feedbackMap.has(fb.customerId)) {
        feedbackMap.set(fb.customerId, fb);
      }
    }

    const items: WorkerSellerItem[] = sellers.map((s) => {
      const fb = feedbackMap.get(s.id);
      const contactPhone = s.phone || (s.user.mobileNumber ? `${s.user.mobileNumberCountryCode || "+91"} ${s.user.mobileNumber}` : null);

      return {
        id: s.id,
        userId: s.userId,
        companyName: s.companyName,
        ownerName: s.ownerName || s.user.name || null,
        email: s.user.email,
        mobileNumber: contactPhone,
        businessType: s.businessType,
        registrationDate: s.createdAt,
        verificationStatus: s.verificationStatus,
        latestFeedback: fb
          ? {
              callStatus: fb.callStatus,
              feedbackNotes: fb.feedbackNotes,
              nextFollowUpDate: fb.nextFollowUpDate,
              lastContactedAt: fb.lastContactedAt || fb.createdAt,
            }
          : null,
      };
    });

    return { success: true, sellers: items };
  } catch (error: any) {
    console.error("getWorkerSellers error:", error);
    return { success: false, error: error?.message || "Failed to load sellers." };
  }
}

/**
 * Get single seller full details for worker modal view
 */
export async function getWorkerSellerDetails(sellerId: string) {
  try {
    await requireWorker();

    const seller = await db.seller.findUnique({
      where: { id: sellerId },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            mobileNumber: true,
            phone: true,
            createdAt: true,
          },
        },
      },
    });

    if (!seller) {
      return { success: false, error: "Seller profile not found." };
    }

    const feedbackHistory = await db.customerFeedback.findMany({
      where: { customerId: sellerId, customerType: "SELLER" },
      orderBy: { createdAt: "desc" },
    });

    return {
      success: true,
      seller: {
        id: seller.id,
        companyName: seller.companyName,
        businessType: seller.businessType,
        description: seller.description,
        gstNumber: seller.gstNumber,
        panNumber: seller.panNumber,
        declaredRevenue: seller.declaredRevenue,
        verificationStatus: seller.verificationStatus,
        phone: seller.phone || seller.user.mobileNumber || seller.user.phone,
        ownerName: seller.ownerName || seller.user.name,
        companyAddress: seller.companyAddress,
        factoryAddress: seller.factoryAddress,
        email: seller.user.email,
        createdAt: seller.createdAt,
        feedbackHistory,
      },
    };
  } catch (error: any) {
    console.error("getWorkerSellerDetails error:", error);
    return { success: false, error: error?.message || "Failed to load seller details." };
  }
}

/**
 * 6. Abandoned Checkouts Section - Real Database Records
 * Excludes completed orders and paid checkouts.
 */
export async function getWorkerAbandonedCheckouts(params?: {
  search?: string;
  startDate?: string;
  endDate?: string;
  sortOrder?: "desc" | "asc";
}): Promise<{
  success: boolean;
  abandonedCheckouts?: WorkerAbandonedCheckoutItem[];
  error?: string;
}> {
  try {
    await requireWorker();

    const thresholdMinutes = await getAbandonmentThresholdMinutes();
    const thresholdDate = new Date(Date.now() - thresholdMinutes * 60 * 1000);
    const search = params?.search?.trim();
    const sortOrder = params?.sortOrder === "asc" ? "asc" : "desc";

    const where: any = {
      paymentStatus: { not: "COMPLETED" },
      resolvedAt: null,
      checkoutStartedAt: { lte: thresholdDate },
    };

    if (search) {
      where.OR = [
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
        { user: { phone: { contains: search, mode: "insensitive" } } },
        { user: { mobileNumber: { contains: search, mode: "insensitive" } } },
      ];
    }

    if (params?.startDate || params?.endDate) {
      where.checkoutStartedAt = { lte: thresholdDate };
      if (params.startDate) where.checkoutStartedAt.gte = new Date(params.startDate);
      if (params.endDate) {
        const end = new Date(params.endDate);
        end.setHours(23, 59, 59, 999);
        where.checkoutStartedAt.lte = end;
      }
    }

    // 1. Fetch tracked AbandonedCheckout entries
    const checkouts = await db.abandonedCheckout.findMany({
      where,
      orderBy: { checkoutStartedAt: sortOrder },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            mobileNumber: true,
            mobileNumberCountryCode: true,
          },
        },
      },
      take: 200,
    });

    // 2. Cross-verify against Order table to ensure NONE of these checkouts have a successfully completed order
    const checkoutRequestIds = checkouts
      .map((c) => c.checkoutRequestId)
      .filter(Boolean) as string[];

    const confirmedOrders = checkoutRequestIds.length > 0
      ? await db.order.findMany({
          where: {
            checkoutRequestId: { in: checkoutRequestIds },
            status: { in: ["CONFIRMED", "PACKED", "SHIPPED", "DELIVERED"] },
          },
          select: { checkoutRequestId: true },
        })
      : [];

    const confirmedSet = new Set(confirmedOrders.map((o) => o.checkoutRequestId));

    const validCheckouts = checkouts.filter((c) => {
      if (c.checkoutRequestId && confirmedSet.has(c.checkoutRequestId)) {
        return false; // Exclude completed orders
      }
      return true;
    });

    const items: WorkerAbandonedCheckoutItem[] = validCheckouts.map((c) => {
      let parsedProducts: any[] = [];
      try {
        if (Array.isArray(c.cartSnapshot)) {
          parsedProducts = c.cartSnapshot;
        } else if (typeof c.cartSnapshot === "string") {
          parsedProducts = JSON.parse(c.cartSnapshot);
        }
      } catch (e) {
        parsedProducts = [];
      }

      const formattedPhone = c.user.mobileNumber
        ? `${c.user.mobileNumberCountryCode || "+91"} ${c.user.mobileNumber}`
        : c.user.phone || null;

      return {
        id: c.id,
        checkoutRequestId: c.checkoutRequestId,
        userId: c.userId,
        customerName: c.user.name || "EarthCentric Buyer",
        customerEmail: c.user.email,
        customerPhone: formattedPhone,
        checkoutStartedAt: c.checkoutStartedAt,
        lastAttemptAt: c.lastAttemptAt,
        attemptCount: c.attemptCount,
        checkoutStatus: c.isAbandoned ? "ABANDONED" : "UNPAID",
        paymentStatus: c.paymentStatus,
        totalCartValue: c.totalAmount,
        products: parsedProducts.map((p: any) => ({
          productId: p.productId || p.id || "",
          name: p.name || "Marketplace Product",
          imageUrl: p.imageUrl || p.image || undefined,
          price: Number(p.price) || 0,
          quantity: Number(p.quantity) || 1,
        })),
        feedbackCallStatus: c.feedbackCallStatus,
        feedbackNotes: c.feedbackNotes,
        abandonmentReason: c.abandonmentReason,
        lastWorkerContactAt: c.lastWorkerContactAt,
      };
    });

    return { success: true, abandonedCheckouts: items };
  } catch (error: any) {
    console.error("getWorkerAbandonedCheckouts error:", error);
    return { success: false, error: error?.message || "Failed to load abandoned checkouts." };
  }
}

/**
 * 7. Feedback & Call Tracking - Save feedback for Buyers or Sellers
 * Preserves complete feedback history instead of overwriting.
 */
export async function saveCustomerFeedback(data: {
  customerId: string;
  customerType: "BUYER" | "SELLER";
  callStatus: string;
  feedbackNotes?: string;
  workerNotes?: string;
  nextFollowUpDate?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await requireWorker();

    if (!data.customerId || !data.customerType || !data.callStatus) {
      return { success: false, error: "Missing required feedback fields." };
    }

    const now = new Date();
    const followUp = data.nextFollowUpDate ? new Date(data.nextFollowUpDate) : null;

    // Create a new CustomerFeedback record (maintaining historical audit trail)
    await db.customerFeedback.create({
      data: {
        customerId: data.customerId,
        customerType: data.customerType,
        callStatus: data.callStatus,
        feedbackNotes: data.feedbackNotes?.trim() || null,
        workerNotes: data.workerNotes?.trim() || null,
        nextFollowUpDate: followUp,
        lastContactedAt: now,
        workerId: auth.userId!,
      },
    });

    // Write audit log entry
    await db.auditLog.create({
      data: {
        action: "WORKER_FEEDBACK_RECORDED",
        details: `Worker ${auth.email} recorded ${data.callStatus} for ${data.customerType} ${data.customerId}`,
        adminEmail: auth.email!,
      },
    });

    return { success: true };
  } catch (error: any) {
    console.error("saveCustomerFeedback error:", error);
    return { success: false, error: error?.message || "Failed to save feedback." };
  }
}

/**
 * 7. Feedback & Call Tracking - Save feedback for Abandoned Checkouts
 */
export async function saveAbandonedCheckoutFeedback(data: {
  checkoutId: string;
  callStatus: string;
  feedbackNotes?: string;
  workerNotes?: string;
  abandonmentReason?: string;
  nextFollowUpDate?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await requireWorker();

    if (!data.checkoutId || !data.callStatus) {
      return { success: false, error: "Missing required checkout feedback fields." };
    }

    const now = new Date();
    const followUp = data.nextFollowUpDate ? new Date(data.nextFollowUpDate) : null;

    // Update AbandonedCheckout record
    const updated = await db.abandonedCheckout.update({
      where: { id: data.checkoutId },
      data: {
        feedbackCallStatus: data.callStatus,
        feedbackNotes: data.feedbackNotes?.trim() || null,
        abandonmentReason: data.abandonmentReason || null,
        workerId: auth.userId,
        lastWorkerContactAt: now,
      },
    });

    // Also write a CustomerFeedback record for customer history tracking
    await db.customerFeedback.create({
      data: {
        customerId: updated.userId,
        customerType: "BUYER",
        callStatus: data.callStatus,
        feedbackNotes: `[Abandoned Checkout ₹${updated.totalAmount}] ${data.feedbackNotes || ""}${data.abandonmentReason ? ` (Reason: ${data.abandonmentReason})` : ""}`.trim(),
        workerNotes: data.workerNotes?.trim() || null,
        nextFollowUpDate: followUp,
        lastContactedAt: now,
        workerId: auth.userId!,
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        action: "WORKER_ABANDONED_CHECKOUT_FEEDBACK",
        details: `Worker ${auth.email} logged ${data.callStatus} for abandoned checkout ${data.checkoutId}`,
        adminEmail: auth.email!,
      },
    });

    return { success: true };
  } catch (error: any) {
    console.error("saveAbandonedCheckoutFeedback error:", error);
    return { success: false, error: error?.message || "Failed to save abandoned checkout feedback." };
  }
}

/**
 * Fetch feedback history for a specific customer
 */
export async function getCustomerFeedbackHistory(customerId: string) {
  try {
    await requireWorker();

    const feedbacks = await db.customerFeedback.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, feedbacks };
  } catch (error: any) {
    console.error("getCustomerFeedbackHistory error:", error);
    return { success: false, error: error?.message || "Failed to load feedback history." };
  }
}
