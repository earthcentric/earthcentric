"use server";

import db from "@/lib/db";
import { getMockSellersInternal } from "@/actions/sellers";
import { Prisma } from "@prisma/client";

export interface MessageAttachment {
  name: string;
  url: string;
  type: "image" | "pdf" | "file";
  size?: number;
}

export interface MessageReference {
  type: "order" | "product" | "complaint" | "discount" | "verification";
  id: string;
  title: string;
  subtitle?: string;
  price?: number;
}

export interface MessageData {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  isRead: boolean;
  isDelivered?: boolean;
  createdAt: Date;
  senderName: string;
  senderRole?: "ADMIN" | "SELLER";
  attachments?: MessageAttachment[];
  reference?: MessageReference | null;
  deletedFor?: string[];
}

export interface AdminConversationSummary {
  sellerId: string;
  sellerUserId: string;
  sellerName: string;
  companyName: string;
  email: string;
  phone: string;
  avatarUrl?: string;
  verificationStatus: string;
  accountStatus: string;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  isOnline?: boolean;
}

// In-memory mock store for messages
const mockMessages: MessageData[] = [
  {
    id: "m-1",
    senderId: "admin-1",
    receiverId: "seller-1",
    content: "Hello Shiva! Welcome to EarthCentric Seller Portal. Please ensure your GST & PAN documents are uploaded.",
    isRead: true,
    isDelivered: true,
    createdAt: new Date(Date.now() - 3600000 * 24),
    senderName: "Super Admin",
    senderRole: "ADMIN",
  },
  {
    id: "m-2",
    senderId: "seller-1",
    receiverId: "admin-1",
    content: "Hi Admin! I have uploaded all required business documents for EcoThreads Apparel. Please review my profile.",
    isRead: true,
    isDelivered: true,
    createdAt: new Date(Date.now() - 3600000 * 20),
    senderName: "Shiva Teja",
    senderRole: "SELLER",
    attachments: [
      {
        name: "gots_organic_cert.pdf",
        url: "https://images.unsplash.com/photo-1606857521015-7f9fcf423740?w=800",
        type: "pdf",
        size: 1024 * 512,
      }
    ]
  },
  {
    id: "m-3",
    senderId: "admin-1",
    receiverId: "seller-1",
    content: "Your seller account for EcoThreads Apparel has been APPROVED! 🚀 You can now publish products to the Marketplace.",
    isRead: true,
    isDelivered: true,
    createdAt: new Date(Date.now() - 3600000 * 10),
    senderName: "Super Admin",
    senderRole: "ADMIN",
    reference: {
      type: "verification",
      id: "seller-1-profile",
      title: "Verification Approved",
      subtitle: "EcoThreads Apparel — Status: APPROVED",
    }
  },
  {
    id: "m-4",
    senderId: "seller-1",
    receiverId: "admin-1",
    content: "Thank you so much! Regarding Order #EC-ORD-8834A, when will buyer payout settlement be processed?",
    isRead: false,
    isDelivered: true,
    createdAt: new Date(Date.now() - 3600000 * 2),
    senderName: "Shiva Teja",
    senderRole: "SELLER",
    reference: {
      type: "order",
      id: "ord-8834a",
      title: "Order #EC-ORD-8834A",
      subtitle: "Organic Cotton Classic Tee — ₹1,899",
      price: 1899,
    }
  },
  {
    id: "m-5",
    senderId: "seller-2",
    receiverId: "admin-1",
    content: "Greetings Admin! We have submitted our BioKnit Textiles product discount for approval.",
    isRead: false,
    isDelivered: true,
    createdAt: new Date(Date.now() - 3600000 * 5),
    senderName: "Rohan Mehta",
    senderRole: "SELLER",
    reference: {
      type: "discount",
      id: "p2",
      title: "Individual Discount Request: 20% OFF",
      subtitle: "Zero-Waste Bamboo Cutlery Set",
    }
  }
];

// Helper to map any ID (User ID, Seller ID, Seller Profile ID, or Email) to User ID in Mock Mode
async function resolveMockUserId(idOrEmail: string): Promise<string> {
  if (!idOrEmail || idOrEmail.trim() === "") return "seller-1";
  if (idOrEmail.includes("admin") || idOrEmail === "admin-1") return "admin-1";
  if (idOrEmail === "seller-1" || idOrEmail === "seller-1-profile" || idOrEmail.includes("bluegamer") || idOrEmail === "buyer-1") return "seller-1";
  if (idOrEmail === "seller-2" || idOrEmail === "seller-2-profile" || idOrEmail.includes("imshivateja") || idOrEmail === "buyer-2") return "seller-2";
  
  try {
    const mockSellers = await getMockSellersInternal();
    const seller = mockSellers.find(s => s.id === idOrEmail || s.userId === idOrEmail || s.user?.email === idOrEmail);
    if (seller) return seller.userId;
  } catch {
    // Fail silently, use default
  }

  return "seller-1";
}

// Helper to map any ID/Email to User ID in DB Mode
async function resolveDbUserId(idOrEmail: string): Promise<string> {
  const isAdmin = !idOrEmail || idOrEmail.includes("admin") || idOrEmail === "admin-1" || idOrEmail === "admin@earthcentric.com";

  try {
    if (isAdmin) {
      let adminUser = await db.user.findFirst({
        where: { OR: [{ role: "ADMIN" }, { email: "admin@earthcentric.com" }] }
      });

      if (!adminUser) {
        adminUser = await db.user.create({
          data: {
            email: "admin@earthcentric.com",
            name: "Super Admin",
            role: "ADMIN",
          }
        });
      }
      return adminUser.id;
    }

    let user = await db.user.findFirst({
      where: { OR: [{ id: idOrEmail }, { email: idOrEmail }] }
    });

    if (!user) {
      const seller = await db.seller.findFirst({
        where: { OR: [{ id: idOrEmail }, { userId: idOrEmail }] }
      });
      if (seller?.userId) {
        user = await db.user.findUnique({ where: { id: seller.userId } });
      }
    }

    if (!user) {
      user = await db.user.findFirst({ where: { role: "SELLER" } });
    }

    if (!user) {
      user = await db.user.create({
        data: {
          email: "seller@earthcentric.com",
          name: "Seller Partner",
          role: "SELLER",
        }
      });
    }

    return user.id;
  } catch {
    return resolveMockUserId(idOrEmail);
  }
}

async function resolveMockSenderName(idOrEmail: string): Promise<string> {
  const uid = await resolveMockUserId(idOrEmail);
  if (uid === "admin-1") return "Super Admin";
  if (uid === "seller-1") return "Shiva Teja";
  if (uid === "seller-2") return "Rohan Mehta";
  return "Seller Partner";
}

export async function sendMessage(
  senderEmailOrId: string, 
  receiverId: string, 
  content: string,
  attachments?: MessageAttachment[],
  reference?: MessageReference | null
) {
  const isMock = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");
  const isAdminSender = senderEmailOrId.includes("admin") || senderEmailOrId === "admin-1" || senderEmailOrId === "admin@earthcentric.com";

  if (!isMock) {
    try {
      const sId = await resolveDbUserId(senderEmailOrId);
      const rId = await resolveDbUserId(receiverId);

      const msg = await db.message.create({
        data: {
          senderId: sId,
          receiverId: rId,
          content,
          isDelivered: true,
          attachments: attachments ? (attachments as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
          reference: reference ? (reference as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
        },
      });

      // Automatically create a notification for the receiver
      try {
        await db.notification.create({
          data: {
            userId: rId,
            title: "New Message",
            message: isAdminSender 
              ? "Super Admin sent you a new message." 
              : "You have received a new message from a seller.",
            actionUrl: isAdminSender ? "/seller/dashboard?tab=messages" : "/admin/dashboard?tab=messages",
          },
        });
      } catch (notifErr) {
        console.error("Notification creation optional error:", notifErr);
      }

      const sender = await db.user.findUnique({ where: { id: sId } });

      const dbFormattedMsg: MessageData = {
        id: msg.id,
        senderId: sId,
        receiverId: rId,
        content: msg.content,
        isRead: msg.isRead,
        isDelivered: msg.isDelivered,
        createdAt: msg.createdAt,
        senderName: sender?.name || (sender?.role === "ADMIN" ? "Super Admin" : "Seller Partner"),
        senderRole: sender?.role === "ADMIN" ? "ADMIN" : "SELLER",
        attachments: (msg.attachments as unknown as MessageAttachment[]) || [],
        reference: (msg.reference as unknown as MessageReference) || null,
      };

      return { success: true, message: dbFormattedMsg };
    } catch (error) {
      console.error("DB sendMessage error (falling back to memory):", error);
    }
  }

  // Memory Mock Execution & Fallback
  try {
    const sId = await resolveMockUserId(senderEmailOrId);
    const rId = await resolveMockUserId(receiverId);
    const senderName = await resolveMockSenderName(senderEmailOrId);
    
    const msg: MessageData = {
      id: `msg-${Date.now()}`,
      senderId: sId,
      receiverId: rId,
      content,
      isRead: false,
      isDelivered: true,
      createdAt: new Date(),
      senderName,
      senderRole: isAdminSender ? "ADMIN" : "SELLER",
      attachments: attachments || [],
      reference: reference || null,
    };
    mockMessages.push(msg);
    return { success: true, message: msg };
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    return { success: false, error: errorMsg };
  }
}

export async function getMessages(user1EmailOrId: string, user2EmailOrId: string): Promise<MessageData[]> {
  const isMock = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");

  if (!isMock) {
    try {
      const id1 = await resolveDbUserId(user1EmailOrId);
      const id2 = await resolveDbUserId(user2EmailOrId);

      const dbMsgs = await db.message.findMany({
        where: {
          OR: [
            { senderId: id1, receiverId: id2 },
            { senderId: id2, receiverId: id1 },
          ],
        },
        include: {
          sender: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      const formattedDbMsgs: MessageData[] = dbMsgs.map((m) => ({
        id: m.id,
        senderId: m.senderId,
        receiverId: m.receiverId,
        content: m.content,
        isRead: m.isRead,
        isDelivered: m.isDelivered,
        createdAt: m.createdAt,
        senderName: m.sender?.name || (m.sender?.role === "ADMIN" ? "Super Admin" : "Seller Partner"),
        senderRole: m.sender?.role === "ADMIN" ? "ADMIN" : "SELLER",
        attachments: (m.attachments as unknown as MessageAttachment[]) || [],
        reference: (m.reference as unknown as MessageReference) || null,
      }));

      return formattedDbMsgs;
    } catch (error) {
      console.error("Prisma getMessages DB error (falling back to memory):", error);
    }
  }

  // Memory Mock Fallback
  const id1 = await resolveMockUserId(user1EmailOrId);
  const id2 = await resolveMockUserId(user2EmailOrId);
  return mockMessages.filter(
    (m) => (m.senderId === id1 && m.receiverId === id2) || (m.senderId === id2 && m.receiverId === id1)
  );
}

export async function markMessagesAsRead(receiverEmailOrId: string, senderEmailOrId: string) {
  const isMock = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");

  if (isMock) {
    const rId = await resolveMockUserId(receiverEmailOrId);
    const sId = await resolveMockUserId(senderEmailOrId);
    mockMessages.forEach((m) => {
      if (m.receiverId === rId && m.senderId === sId) {
        m.isRead = true;
      }
    });
    return true;
  }

  try {
    const rId = await resolveDbUserId(receiverEmailOrId);
    const sId = await resolveDbUserId(senderEmailOrId);

    await db.message.updateMany({
      where: {
        receiverId: rId,
        senderId: sId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });
    return true;
  } catch (error) {
    console.error("Error marking messages as read:", error);
    return false;
  }
}

export async function getAllConversationsForAdmin(): Promise<AdminConversationSummary[]> {
  const isMock = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");

  if (!isMock) {
    try {
      const dbSellers = await db.seller.findMany({
        include: {
          user: true,
        },
      });

      const adminId = await resolveDbUserId("admin-1");
      const summaries: AdminConversationSummary[] = [];

      for (const seller of dbSellers) {
        const sellerUserId = seller.userId;
        
        const conversationMsgs = await db.message.findMany({
          where: {
            OR: [
              { senderId: adminId, receiverId: sellerUserId },
              { senderId: sellerUserId, receiverId: adminId },
            ],
          },
          orderBy: {
            createdAt: "desc",
          },
        });

        const lastMsg = conversationMsgs[0];
        const unreadCount = conversationMsgs.filter(
          (m) => m.receiverId === adminId && !m.isRead
        ).length;

        summaries.push({
          sellerId: seller.id,
          sellerUserId: sellerUserId,
          sellerName: seller.ownerName || seller.founderName || seller.user?.name || "Seller Partner",
          companyName: seller.companyName || "Organic Store",
          email: seller.user?.email || "seller@earthcentric.com",
          phone: seller.phone || "",
          avatarUrl: seller.logoUrl || `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150`,
          verificationStatus: seller.verificationStatus || "APPROVED",
          accountStatus: "ACTIVE",
          lastMessage: lastMsg ? lastMsg.content : "No messages yet.",
          lastMessageTime: lastMsg ? new Date(lastMsg.createdAt) : new Date(Date.now() - 3600000 * 48),
          unreadCount,
          isOnline: sellerUserId === "seller-1" || false,
        });
      }

      summaries.sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());
      return summaries;
    } catch {
      // Fallback
    }
  }

  // Fallback to Mock
  try {
    const mockSellers = await getMockSellersInternal();
    const adminId = "admin-1";

    const summaries: AdminConversationSummary[] = mockSellers.map((seller) => {
      const sellerUserId = seller.userId || seller.id;
      const conversationMsgs = mockMessages.filter(
        (m) => (m.senderId === adminId && m.receiverId === sellerUserId) ||
               (m.senderId === sellerUserId && m.receiverId === adminId)
      );

      conversationMsgs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const lastMsg = conversationMsgs[0];
      const unreadCount = conversationMsgs.filter((m) => m.receiverId === adminId && !m.isRead).length;

      return {
        sellerId: seller.id,
        sellerUserId: sellerUserId,
        sellerName: seller.ownerName || seller.founderName || seller.userName || "Seller Partner",
        companyName: seller.companyName || "Organic Store",
        email: seller.user?.email || (sellerUserId === "seller-1" ? "bluegamer355@gmail.com" : "imshivateja082@gmail.com"),
        phone: seller.phone || (sellerUserId === "seller-1" ? "+91 98765 43210" : "+91 98123 45678"),
        avatarUrl: seller.logoUrl || `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150`,
        verificationStatus: seller.verificationStatus || "APPROVED",
        accountStatus: "ACTIVE",
        lastMessage: lastMsg ? lastMsg.content : "No messages yet.",
        lastMessageTime: lastMsg ? new Date(lastMsg.createdAt) : new Date(Date.now() - 3600000 * 48),
        unreadCount,
        isOnline: sellerUserId === "seller-1",
      };
    });

    summaries.sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());
    return summaries;
  } catch (e) {
    console.error("Error getting admin conversations:", e);
    return [];
  }
}

export async function getUnreadMessageCount(userEmailOrId: string): Promise<number> {
  const isMock = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");

  if (isMock) {
    const uId = await resolveMockUserId(userEmailOrId);
    return mockMessages.filter((m) => m.receiverId === uId && !m.isRead).length;
  }

  try {
    const uId = await resolveDbUserId(userEmailOrId);
    return await db.message.count({
      where: { receiverId: uId, isRead: false },
    });
  } catch {
    return 0;
  }
}
