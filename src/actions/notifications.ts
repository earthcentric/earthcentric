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

  if (isMock) {
    if (!mockUserNotifications[userId]) {
      mockUserNotifications[userId] = [
        {
          id: "user-mock-n1",
          title: "Welcome to EarthCentric",
          message: "Your seller account setup is complete. Start listing products!",
          actionUrl: "dashboard",
          isRead: false,
          createdAt: new Date(Date.now() - 86400000)
        },
        {
          id: "user-mock-n2",
          title: "Product Approved",
          message: "Your listing 'Bamboo Fiber Sheets' has been approved and is now live.",
          actionUrl: "products",
          isRead: false,
          createdAt: new Date(Date.now() - 3600000 * 4)
        },
        {
          id: "user-mock-n3",
          title: "New Message",
          message: "You have a new message from Super Admin.",
          actionUrl: "messages",
          isRead: false,
          createdAt: new Date(Date.now() - 3600000 * 2)
        }
      ];
    }
    return mockUserNotifications[userId].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  try {
    const dbNotifs = await db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }
    });
    
    return dbNotifs.map(n => {
      let displayMessage = n.message;
      let actionUrl = n.actionUrl || "dashboard";

      if (n.message.includes("|redirect:")) {
        const parts = n.message.split("|redirect:");
        displayMessage = parts[0].trim();
        actionUrl = parts[1].trim();
      }

      return {
        id: n.id,
        title: n.title,
        message: displayMessage,
        actionUrl,
        isRead: n.isRead,
        createdAt: n.createdAt
      };
    });
  } catch (e) {
    console.error("getUserNotifications failed:", e);
    return [];
  }
}
