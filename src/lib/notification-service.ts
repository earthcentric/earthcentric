import "server-only";

import db from "@/lib/db";

interface MockNotification {
  id: string;
  title: string;
  message: string;
  redirectSection?: string;
  actionUrl?: string;
  isRead: boolean;
  createdAt: Date;
}

export const mockAdminNotifications: MockNotification[] = [
  {
    id: "mock-n1",
    title: "System Update",
    message: "Welcome to EarthCentric Dashboard. Notifications are active.",
    redirectSection: "dashboard",
    actionUrl: "dashboard",
    isRead: false,
    createdAt: new Date(Date.now() - 3600000),
  },
];

export const mockUserNotifications: Record<string, MockNotification[]> = {};

export async function createNotificationRecord(
  userId: string,
  title: string,
  message: string,
  sectionOrUrl: string
) {
  const isMock = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");
  if (isMock) {
    if (!mockUserNotifications[userId]) mockUserNotifications[userId] = [];
    mockUserNotifications[userId].push({
      id: `notif-${Date.now()}`,
      title,
      message,
      actionUrl: sectionOrUrl,
      isRead: false,
      createdAt: new Date(),
    });
    return;
  }

  try {
    await db.notification.create({
      data: { userId, title, message, actionUrl: sectionOrUrl },
    });
  } catch (error) {
    console.error("createNotification failed:", error);
  }
}

export async function createAdminNotificationRecord(
  title: string,
  message: string,
  sectionOrUrl: string
) {
  const isMock = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");
  if (isMock) {
    mockAdminNotifications.push({
      id: `notif-${Date.now()}`,
      title,
      message,
      redirectSection: sectionOrUrl,
      actionUrl: sectionOrUrl,
      isRead: false,
      createdAt: new Date(),
    });
    return;
  }

  try {
    const admin = await db.user.findFirst({
      where: { role: "ADMIN" },
      select: { id: true },
    });
    if (admin) {
      await createNotificationRecord(admin.id, title, message, sectionOrUrl);
    }
  } catch (error) {
    console.error("createAdminNotification failed:", error);
  }
}

export const createNotification = createNotificationRecord;
export const createAdminNotification = createAdminNotificationRecord;
