"use server";

import db from "@/lib/db";
import { getMockSellersInternal } from "@/actions/sellers";
import { verifyAdminAuth, verifyAuthenticatedUser } from "@/lib/auth-server";
import {
  createAdminNotificationRecord,
  createNotificationRecord,
  mockAdminNotifications,
  mockUserNotifications,
} from "@/lib/notification-service";

export async function createNotification(userId: string, title: string, message: string, sectionOrUrl: string) {
  const auth = await verifyAuthenticatedUser();
  if (!auth.authorized || !auth.userId) throw new Error("Sign in before creating a notification.");
  const admin = await verifyAdminAuth();
  if (userId !== auth.userId && !admin.authorized) {
    throw new Error("You can only create notifications for your own account.");
  }
  await createNotificationRecord(userId, title, message, sectionOrUrl);
}

export async function createAdminNotification(title: string, message: string, sectionOrUrl: string) {
  const auth = await verifyAdminAuth();
  if (!auth.authorized) throw new Error("Super Admin access is required.");
  await createAdminNotificationRecord(title, message, sectionOrUrl);
}

export async function getAdminNotifications() {
  const auth = await verifyAdminAuth();
  if (!auth.authorized) return [];
  const isMock = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");

  if (isMock) {
    const notificationsList = [...mockAdminNotifications];
    try {
      const sellers = await getMockSellersInternal();
      sellers.filter(s => s.verificationStatus === "PENDING").forEach(s => {
        const exists = notificationsList.some(n => n.message.includes(s.companyName) && n.redirectSection === "sellers");
        if (!exists) {
          notificationsList.push({
            id: `seller-${s.id}`,
            title: "New Seller Onboarding",
            message: `Seller "${s.companyName}" submitted their verification documents for review.`,
            redirectSection: "sellers",
            actionUrl: "/admin/dashboard?tab=sellers",
            isRead: false,
            createdAt: new Date()
          });
        }
      });
    } catch (e) {}



    // Add mock dispute notification
    notificationsList.push({
      id: "dispute-mock-1",
      title: "New Dispute Raised",
      message: `Order EC-ORD-4729 has a pending dispute raised: "Package damaged during transit".`,
      redirectSection: "disputes",
      actionUrl: "/admin/dashboard?tab=disputes",
      isRead: false,
      createdAt: new Date(Date.now() - 14400000)
    });

    return notificationsList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  try {
    const admin = await db.user.findFirst({
      where: { role: "ADMIN" }
    });
    if (!admin) return [];

    // Fetch static notifications from DB
    const dbNotifs = await db.notification.findMany({
      where: { userId: admin.id },
      orderBy: { createdAt: "desc" }
    });

    const notificationsList = dbNotifs.map(n => {
      let redirectSection = "dashboard";
      let displayMessage = n.message;
      let actionUrl = n.actionUrl || "dashboard";

      // Fallback for old notifications
      if (n.message.includes("|redirect:")) {
        const parts = n.message.split("|redirect:");
        displayMessage = parts[0].trim();
        actionUrl = parts[1].trim();
      }

      return {
        id: n.id,
        title: n.title,
        message: displayMessage,
        redirectSection: actionUrl, // keep this for backward compatibility with admin dashboard
        actionUrl,
        isRead: n.isRead,
        createdAt: n.createdAt
      };
    });

    // 1. Fetch pending sellers
    const pendingSellers = await db.seller.findMany({
      where: { verificationStatus: "PENDING" },
      select: { id: true, companyName: true, createdAt: true }
    });
    pendingSellers.forEach(s => {
      const exists = notificationsList.some(n => n.message.includes(s.companyName) && n.redirectSection === "sellers");
      if (!exists) {
        notificationsList.push({
          id: `seller-${s.id}`,
          title: "New Seller Onboarding",
          message: `Seller "${s.companyName}" submitted their verification documents for review.`,
          redirectSection: "sellers",
          actionUrl: "/admin/dashboard?tab=sellers",
          isRead: false,
          createdAt: s.createdAt
        });
      }
    });

    // 2. Fetch pending products
    const pendingProducts = await db.product.findMany({
      where: { isApproved: false, isArchived: false },
      select: { id: true, name: true, createdAt: true, seller: { select: { companyName: true } } }
    });
    pendingProducts.forEach(p => {
      const exists = notificationsList.some(n => n.message.includes(p.name) && n.redirectSection === "products");
      if (!exists) {
        notificationsList.push({
          id: `product-${p.id}`,
          title: "Product Approval Required",
          message: `Seller "${p.seller.companyName}" added a new product "${p.name}" which requires approval.`,
          redirectSection: "products",
          actionUrl: "/admin/dashboard?tab=products",
          isRead: false,
          createdAt: p.createdAt
        });
      }
    });

    // 3. Fetch pending payouts
    const pendingPayouts = await db.payoutRequest.findMany({
      where: { status: "PENDING" },
      select: { id: true, amount: true, requestedAt: true, seller: { select: { companyName: true } } }
    });
    pendingPayouts.forEach(p => {
      const exists = notificationsList.some(n => n.message.includes(p.seller.companyName) && n.message.includes(p.amount.toString()) && n.redirectSection === "payments");
      if (!exists) {
        notificationsList.push({
          id: `payout-${p.id}`,
          title: "Payout Requested",
          message: `Seller "${p.seller.companyName}" has requested a payout of ₹${p.amount}.`,
          redirectSection: "payments",
          actionUrl: "/admin/dashboard?tab=payments",
          isRead: false,
          createdAt: p.requestedAt
        });
      }
    });

    // 4. Fetch pending disputes
    const pendingDisputes = await db.complaint.findMany({
      where: { status: "PENDING" },
      select: { id: true, orderId: true, subject: true, createdAt: true }
    });
    pendingDisputes.forEach(d => {
      const exists = notificationsList.some(n => n.message.includes(d.orderId) && n.redirectSection === "disputes");
      if (!exists) {
        notificationsList.push({
          id: `dispute-${d.id}`,
          title: "New Dispute Raised",
          message: `Order EC-ORD-${d.orderId.substring(4, 10).toUpperCase()} has a pending dispute raised: "${d.subject}".`,
          redirectSection: "disputes",
          actionUrl: "/admin/dashboard?tab=disputes",
          isRead: false,
          createdAt: d.createdAt
        });
      }
    });

    // 5. Fetch pending discount requests
    try {
      const pendingDiscounts = await (db as any).discountApprovalRequest.findMany({
        where: { status: "PENDING" },
        include: {
          product: { select: { name: true } },
          seller: { select: { companyName: true } },
        },
      });
      pendingDiscounts.forEach((disc: any) => {
        const notifId = `disc-${disc.id}`;
        const exists = notificationsList.some(n => n.id === notifId || (n.message.includes(disc.product?.name) && (n.actionUrl.includes("discounts") || n.actionUrl.includes("promotions"))));
        if (!exists) {
          const typeLabel = disc.discountType === "INDIVIDUAL" ? "Individual Product Discount" : disc.discountType === "TIER" ? "Tier Discounts" : "Buy X Get Y Free Offer";
          const actionLabel = disc.requestedAction === "DEACTIVATE" ? "deactivate" : disc.requestedAction === "UPDATE" ? "update" : "activate";
          notificationsList.push({
            id: notifId,
            title: `Discount ${disc.requestedAction === "DEACTIVATE" ? "Deactivation" : "Approval"} Required 🏷️`,
            message: `Seller "${disc.seller?.companyName}" requested to ${actionLabel} ${typeLabel} on "${disc.product?.name}".`,
            redirectSection: "discounts",
            actionUrl: "/admin/dashboard?tab=discounts",
            isRead: false,
            createdAt: disc.requestedAt,
          });
        }
      });
    } catch (discErr) {}

    // Sort by date descending
    return notificationsList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (e) {
    console.error("getAdminNotifications failed:", e);
    return [];
  }
}

export async function markNotificationAsRead(id: string) {
  const auth = await verifyAuthenticatedUser();
  if (!auth.authorized || !auth.userId) return false;
  const admin = await verifyAdminAuth();
  const isMock = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");
  if (isMock) {
    const adminNotification = mockAdminNotifications.find((notification) => notification.id === id);
    if (adminNotification) {
      if (!admin.authorized) return false;
      adminNotification.isRead = true;
      return true;
    }
    const userNotification = mockUserNotifications[auth.userId]?.find((notification) => notification.id === id);
    if (!userNotification) return false;
    userNotification.isRead = true;
    return true;
  }

  try {
    const result = await db.notification.updateMany({
      where: { id, userId: auth.userId },
      data: { isRead: true }
    });
    return result.count > 0;
  } catch (e) {
    console.error("markNotificationAsRead failed:", e);
    return false;
  }
}

export async function getUserNotifications(_userId: string, _isSeller: boolean = false) {
  const auth = await verifyAuthenticatedUser();
  if (!auth.authorized || !auth.userId || auth.userId !== _userId) return [];
  void _isSeller;
  const userId = auth.userId;
  const isSeller = auth.role === "SELLER" || Boolean(auth.sellerId);
  const isMock = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");

  // Default eco offers & deals for all buyers
  const defaultOffers = [
    {
      id: "offer-deal-1",
      title: "🔥 Special Eco Deal: 20% OFF",
      message: "Use coupon code EARTH20 at checkout for 20% off all sustainable packaging & tableware!",
      type: "OFFER",
      actionUrl: "/marketplace",
      isRead: false,
      createdAt: new Date(Date.now() - 3600000 * 2)
    },
    {
      id: "offer-deal-2",
      title: "🌱 Welcome to EarthCentric!",
      message: "Thank you for joining our carbon-neutral marketplace! Get 15% off your first order with WELCOME15.",
      type: "DEAL",
      actionUrl: "/marketplace",
      isRead: false,
      createdAt: new Date(Date.now() - 86400000)
    },
    {
      id: "offer-deal-3",
      title: "⚡ Free Shipping Weekend",
      message: "Enjoy zero carbon-offset delivery fees on all orders above ₹499 this weekend.",
      type: "OFFER",
      actionUrl: "/marketplace",
      isRead: false,
      createdAt: new Date(Date.now() - 3600000 * 12)
    }
  ];

  const isSellerAlert = (n: any) => {
    const t = (n.title || "").toLowerCase();
    const a = (n.actionUrl || "").toLowerCase();
    return (
      t.includes("new bulk quote enquiry") ||
      t.includes("payout requested") ||
      t.includes("payout settled") ||
      t.includes("product approval") ||
      t.includes("seller onboarding") ||
      t.includes("discount") ||
      a.includes("/seller/dashboard")
    );
  };

  if (isMock) {
    if (!mockUserNotifications[userId]) {
      mockUserNotifications[userId] = [...defaultOffers];
    }
    const filteredMock = isSeller
      ? mockUserNotifications[userId]
      : mockUserNotifications[userId].filter((n) => !isSellerAlert(n));
    return filteredMock.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  try {
    // 1. Fetch DB notifications
    const dbNotifs = await db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }
    });

    const notifList = dbNotifs.map(n => {
      let displayMessage = n.message;
      let actionUrl = n.actionUrl || "/orders";

      if (n.message.includes("|redirect:")) {
        const parts = n.message.split("|redirect:");
        displayMessage = parts[0].trim();
        actionUrl = parts[1].trim();
      }

      return {
        id: n.id,
        title: n.title,
        message: displayMessage,
        type: n.title.toLowerCase().includes("order") ? "ORDER" : n.title.toLowerCase().includes("deal") || n.title.toLowerCase().includes("offer") ? "OFFER" : "SYSTEM",
        actionUrl,
        isRead: n.isRead,
        createdAt: n.createdAt
      };
    });

    if (isSeller) {
      return notifList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    // 2. Fetch Buyer's Orders to auto-generate Order Booked / Cancelled / Shipped notifications if missing
    try {
      const userOrders = await db.order.findMany({
        where: { userId },
        select: { id: true, status: true, totalAmount: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 10
      });

      userOrders.forEach(ord => {
        const exists = notifList.some(n => n.message.includes(ord.id) || n.id.includes(ord.id));
        if (!exists) {
          let title = "Order Placed 📦";
          let message = `Your order ${ord.id} of ₹${ord.totalAmount} has been placed successfully.`;
          let type = "ORDER";

          if (ord.status === "CONFIRMED") {
            title = "Order Booked & Confirmed ✅";
            message = `Your order ${ord.id} has been confirmed and sent to fulfillment!`;
          } else if (ord.status === "CANCELLED") {
            title = "Order Cancelled ❌";
            message = `Your order ${ord.id} was cancelled. Any charged amount will be refunded.`;
          } else if (ord.status === "SHIPPED") {
            title = "Order Out for Delivery 🚚";
            message = `Your order ${ord.id} has been shipped and is on its way.`;
          } else if (ord.status === "DELIVERED") {
            title = "Order Delivered 🎉";
            message = `Your order ${ord.id} has been delivered. Enjoy your eco-friendly product!`;
          }

          notifList.push({
            id: `ord-notif-${ord.id}`,
            title,
            message,
            type,
            actionUrl: `/orders/${ord.id}`,
            isRead: false,
            createdAt: ord.createdAt
          });
        }
      });
    } catch (e) {
      console.warn("Failed to fetch user orders for notifications:", e);
    }

    // 3. Check if Buyer has a Seller application needing attention (NEED_MORE_DOCS, REJECTED, APPROVED, SUSPENDED)
    try {
      const sellerApp = await db.seller.findFirst({
        where: { userId },
        select: { id: true, verificationStatus: true, rejectionReason: true, updatedAt: true, companyName: true }
      });
      if (sellerApp) {
        if (sellerApp.verificationStatus === "NEED_MORE_DOCS") {
          const notifId = `seller-docs-${sellerApp.id}`;
          if (!notifList.some(n => n.id === notifId || n.title.includes("Additional Documents"))) {
            notifList.unshift({
              id: notifId,
              title: "Action Required: Additional Documents Needed ⚠️",
              message: `Super Admin requested more documents for your seller application (${sellerApp.companyName}): ${sellerApp.rejectionReason || "Please upload clear legal identity documents."}`,
              type: "SYSTEM",
              actionUrl: "/account?tab=seller",
              isRead: false,
              createdAt: sellerApp.updatedAt || new Date()
            });
          }
        } else if (sellerApp.verificationStatus === "REJECTED") {
          const notifId = `seller-rej-${sellerApp.id}`;
          if (!notifList.some(n => n.id === notifId || n.title.includes("Application Rejected"))) {
            notifList.unshift({
              id: notifId,
              title: "Seller Application Rejected ❌",
              message: `Your seller application (${sellerApp.companyName}) could not be approved at this time. Reason: ${sellerApp.rejectionReason || "Criteria not met."}`,
              type: "SYSTEM",
              actionUrl: "/account?tab=seller",
              isRead: false,
              createdAt: sellerApp.updatedAt || new Date()
            });
          }
        } else if (sellerApp.verificationStatus === "APPROVED") {
          const notifId = `seller-appr-${sellerApp.id}`;
          if (!notifList.some(n => n.id === notifId || n.title.includes("Verified Seller"))) {
            notifList.unshift({
              id: notifId,
              title: "You Are a Verified Seller! 🎉",
              message: `Congratulations! ${sellerApp.companyName} has been approved by Super Admin. Your seller dashboard is unlocked and ready!`,
              type: "SYSTEM",
              actionUrl: "/seller/dashboard",
              isRead: false,
              createdAt: sellerApp.updatedAt || new Date()
            });
          }
        } else if (sellerApp.verificationStatus === "SUSPENDED") {
          const notifId = `seller-susp-${sellerApp.id}`;
          if (!notifList.some(n => n.id === notifId || n.title.includes("Account Suspended"))) {
            notifList.unshift({
              id: notifId,
              title: "Account Suspended ⚠️",
              message: `Your seller privileges have been suspended. Reason: ${sellerApp.rejectionReason || "Violation of terms."}`,
              type: "SYSTEM",
              actionUrl: "/account",
              isRead: false,
              createdAt: sellerApp.updatedAt || new Date()
            });
          }
        }
      }
    } catch (e) {
      console.warn("Failed to check seller app status for notifications:", e);
    }

    // Combine with offers if user has few notifications
    defaultOffers.forEach(offer => {
      if (!notifList.some(n => n.id === offer.id)) {
        notifList.push(offer);
      }
    });

    // Filter out seller-management alerts from buyer notification menu
    const buyerOnlyNotifs = notifList.filter((n) => !isSellerAlert(n));

    return buyerOnlyNotifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (e) {
    console.error("getUserNotifications failed:", e);
    return defaultOffers;
  }
}

export async function markAllNotificationsAsRead(_userId: string) {
  const auth = await verifyAuthenticatedUser();
  if (!auth.authorized || !auth.userId || auth.userId !== _userId) return false;
  const userId = auth.userId;
  const isMock = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");

  if (isMock) {
    if (mockUserNotifications[userId]) {
      mockUserNotifications[userId].forEach(n => { n.isRead = true; });
    }
    return true;
  }

  try {
    await db.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true }
    });
    return true;
  } catch (e) {
    console.error("markAllNotificationsAsRead failed:", e);
    return false;
  }
}
