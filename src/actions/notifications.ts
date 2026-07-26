"use server";

import db from "@/lib/db";
import { getMockSellersInternal } from "@/actions/sellers";

let mockAdminNotifications: any[] = [
  {
    id: "mock-n1",
    title: "System Update",
    message: "Welcome to EarthCentric Dashboard. Notifications are active.",
    redirectSection: "dashboard",
    actionUrl: "dashboard",
    isRead: false,
    createdAt: new Date(Date.now() - 3600000)
  }
];

let mockUserNotifications: Record<string, any[]> = {};

export async function createNotification(userId: string, title: string, message: string, sectionOrUrl: string) {
  const isMock = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");
  if (isMock) {
    if (!mockUserNotifications[userId]) {
      mockUserNotifications[userId] = [];
    }
    mockUserNotifications[userId].push({
      id: `notif-${Date.now()}`,
      title,
      message,
      actionUrl: sectionOrUrl,
      isRead: false,
      createdAt: new Date()
    });
    return;
  }

  try {
    await db.notification.create({
      data: {
        userId,
        title,
        message,
        actionUrl: sectionOrUrl,
      }
    });
  } catch (e) {
    console.error("createNotification failed:", e);
  }
}

export async function createAdminNotification(title: string, message: string, sectionOrUrl: string) {
  const isMock = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");
  if (isMock) {
    mockAdminNotifications.push({
      id: `notif-${Date.now()}`,
      title,
      message,
      redirectSection: sectionOrUrl,
      actionUrl: sectionOrUrl,
      isRead: false,
      createdAt: new Date()
    });
    return;
  }

  try {
    const admin = await db.user.findFirst({
      where: { role: "ADMIN" }
    });
    if (admin) {
      await createNotification(admin.id, title, message, sectionOrUrl);
    }
  } catch (e) {
    console.error("createAdminNotification failed:", e);
  }
}

export async function getAdminNotifications() {
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

    // Add mock product approval notifications
    notificationsList.push({
      id: "product-mock-1",
      title: "Product Approval Required",
      message: `Seller "EcoThreads Apparel" added a new product "Organic Hemp Denim Jacket" which requires approval.`,
      redirectSection: "products",
      actionUrl: "/admin/dashboard?tab=products",
      isRead: false,
      createdAt: new Date(Date.now() - 7200000)
    });

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

    // Sort by date descending
    return notificationsList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (e) {
    console.error("getAdminNotifications failed:", e);
    return [];
  }
}

export async function markNotificationAsRead(id: string) {
  const isMock = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");
  if (isMock) {
    let found = false;
    mockAdminNotifications.forEach(n => {
      if (n.id === id) {
        n.isRead = true;
        found = true;
      }
    });
    if (!found) {
      Object.keys(mockUserNotifications).forEach(uid => {
        mockUserNotifications[uid].forEach(n => {
          if (n.id === id) {
            n.isRead = true;
          }
        });
      });
    }
    return true;
  }

  try {
    await db.notification.update({
      where: { id },
      data: { isRead: true }
    });
    return true;
  } catch (e) {
    console.error("markNotificationAsRead failed:", e);
    return false;
  }
}

export async function getUserNotifications(userId: string) {
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
      a.includes("/seller/dashboard?tab=enquiries")
    );
  };

  if (isMock) {
    if (!mockUserNotifications[userId]) {
      mockUserNotifications[userId] = [...defaultOffers];
    }
    const filteredMock = mockUserNotifications[userId].filter((n) => !isSellerAlert(n));
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

export async function markAllNotificationsAsRead(userId: string) {
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

