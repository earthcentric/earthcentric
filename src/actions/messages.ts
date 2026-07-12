"use server";

import db from "@/lib/db";
import { getMockSellersInternal } from "@/actions/sellers";

export interface MessageData {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  isRead: boolean;
  createdAt: Date;
  senderName: string;
}

// In-memory mock store for messages
let mockMessages: MessageData[] = [
  {
    id: "m-1",
    senderId: "admin-1",
    receiverId: "seller-1",
    content: "Hello, welcome to EarthCentric! Please upload your business details for verification.",
    isRead: true,
    createdAt: new Date(Date.now() - 3600000 * 2),
    senderName: "Super Admin",
  },
  {
    id: "m-2",
    senderId: "seller-1",
    receiverId: "admin-1",
    content: "Hi Admin! I have uploaded the documents. Please check them.",
    isRead: true,
    createdAt: new Date(Date.now() - 3600000 * 1),
    senderName: "Shiva Teja",
  }
];

// Helper to map any ID (User ID, Seller ID, Seller Profile ID, or Email) to User ID in Mock Mode
async function resolveMockUserId(idOrEmail: string): Promise<string> {
  if (idOrEmail.includes("admin") || idOrEmail === "admin-1") return "admin-1";
  if (idOrEmail === "seller-1" || idOrEmail === "seller-1-profile" || idOrEmail.includes("bluegamer")) return "seller-1";
  if (idOrEmail === "seller-2" || idOrEmail === "seller-2-profile" || idOrEmail.includes("imshivateja")) return "seller-2";
  
  try {
    const mockSellers = await getMockSellersInternal();
    const seller = mockSellers.find(s => s.id === idOrEmail || s.userId === idOrEmail);
    if (seller) return seller.userId;
  } catch (e) {}

  return idOrEmail;
}

// Helper to map any ID/Email to User ID in DB Mode
async function resolveDbUserId(idOrEmail: string): Promise<string> {
  // Check user first
  const user = await db.user.findFirst({
    where: { OR: [{ email: idOrEmail }, { id: idOrEmail }] }
  });
  if (user) return user.id;

  // Check seller
  const seller = await db.seller.findFirst({
    where: { OR: [{ id: idOrEmail }, { userId: idOrEmail }] }
  });
  if (seller) return seller.userId;

  return idOrEmail;
}

async function resolveMockSenderName(idOrEmail: string): Promise<string> {
  const uid = await resolveMockUserId(idOrEmail);
  if (uid === "admin-1") return "Super Admin";
  if (uid === "seller-1") return "Shiva Teja";
  if (uid === "seller-2") return "Shiva Teja Yadav";
  return "Seller Partner";
}

export async function sendMessage(senderEmailOrId: string, receiverId: string, content: string) {
  const isMock = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");

  if (isMock) {
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
        createdAt: new Date(),
        senderName,
      };
      mockMessages.push(msg);
      return { success: true, message: msg };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  try {
    const sId = await resolveDbUserId(senderEmailOrId);
    const rId = await resolveDbUserId(receiverId);

    const msg = await db.message.create({
      data: {
        senderId: sId,
        receiverId: rId,
        content,
      },
    });

    // Automatically create a notification for the receiver
    await db.notification.create({
      data: {
        userId: rId,
        title: "New Message",
        message: "You have received a new message.",
        actionUrl: "/seller/dashboard?tab=messages",
      },
    });

    return { success: true, message: msg };
  } catch (error: any) {
    console.error("Error sending message:", error);
    return { success: false, error: error.message || "Failed to send message" };
  }
}

export async function getMessages(user1EmailOrId: string, user2EmailOrId: string) {
  const isMock = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");

  if (isMock) {
    const id1 = await resolveMockUserId(user1EmailOrId);
    const id2 = await resolveMockUserId(user2EmailOrId);
    return mockMessages.filter(
      (m) => (m.senderId === id1 && m.receiverId === id2) || (m.senderId === id2 && m.receiverId === id1)
    );
  }

  try {
    const id1 = await resolveDbUserId(user1EmailOrId);
    const id2 = await resolveDbUserId(user2EmailOrId);

    const messages = await db.message.findMany({
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

    return messages.map((m) => ({
      id: m.id,
      senderId: m.senderId,
      receiverId: m.receiverId,
      content: m.content,
      isRead: m.isRead,
      createdAt: m.createdAt,
      senderName: m.sender.name || "Unknown",
    }));
  } catch (error) {
    console.error("Error fetching messages:", error);
    return [];
  }
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
