"use server";

import db from "@/lib/db";
import { createAdminNotification } from "@/actions/notifications";

export interface ComplaintData {
  id: string;
  orderId: string;
  userId: string;
  buyerName: string;
  type: string;
  subject: string;
  message: string;
  proofUrl?: string | null;
  status: string;
  sellerResponse?: string | null;
  sellerProofUrl?: string | null;
  adminNotes?: string | null;
  createdAt: Date;
}

export async function createComplaint(data: {
  orderId: string;
  userId: string;
  type: string;
  subject: string;
  message: string;
  proofUrl?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await db.complaint.create({
      data: {
        orderId: data.orderId,
        userId: data.userId,
        type: data.type,
        subject: data.subject,
        message: data.message,
        proofUrl: data.proofUrl || null,
        status: "PENDING",
      },
    });

    // Update order timeline
    await db.orderTimeline.create({
      data: {
        orderId: data.orderId,
        status: "RETURNED", // Flag that the order has an issue raised
        description: `Customer raised a complaint (${data.type}): "${data.subject}"`,
      },
    });

    await createAdminNotification(
      "New Dispute Raised",
      `Order EC-ORD-${data.orderId.substring(4, 10).toUpperCase()} has a pending dispute raised.`,
      "disputes"
    );

    return { success: true };
  } catch (error) {
    console.error("Failed to create complaint:", error);
    return { success: false, error: "Failed to submit dispute complaint." };
  }
}

export async function getBuyerComplaints(userId: string): Promise<ComplaintData[]> {
  try {
    const complaints = await db.complaint.findMany({
      where: { userId },
      include: {
        user: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return complaints.map((c) => ({
      id: c.id,
      orderId: c.orderId,
      userId: c.userId,
      buyerName: c.user.name || "Customer",
      type: c.type,
      subject: c.subject,
      message: c.message,
      proofUrl: c.proofUrl,
      status: c.status,
      sellerResponse: c.sellerResponse,
      sellerProofUrl: c.sellerProofUrl,
      adminNotes: c.adminNotes,
      createdAt: c.createdAt,
    }));
  } catch (error) {
    console.error("Failed to get buyer complaints:", error);
    return [];
  }
}

export async function getSellerComplaints(sellerId: string): Promise<ComplaintData[]> {
  try {
    // Find orders containing seller's products
    const complaints = await db.complaint.findMany({
      where: {
        order: {
          items: {
            some: {
              product: { sellerId },
            },
          },
        },
      },
      include: {
        user: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return complaints.map((c) => ({
      id: c.id,
      orderId: c.orderId,
      userId: c.userId,
      buyerName: c.user.name || "Customer",
      type: c.type,
      subject: c.subject,
      message: c.message,
      proofUrl: c.proofUrl,
      status: c.status,
      sellerResponse: c.sellerResponse,
      sellerProofUrl: c.sellerProofUrl,
      adminNotes: c.adminNotes,
      createdAt: c.createdAt,
    }));
  } catch (error) {
    console.error("Failed to get seller complaints:", error);
    return [];
  }
}

export async function getAdminComplaints(): Promise<ComplaintData[]> {
  try {
    const complaints = await db.complaint.findMany({
      include: {
        user: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return complaints.map((c) => ({
      id: c.id,
      orderId: c.orderId,
      userId: c.userId,
      buyerName: c.user.name || "Customer",
      type: c.type,
      subject: c.subject,
      message: c.message,
      proofUrl: c.proofUrl,
      status: c.status,
      sellerResponse: c.sellerResponse,
      sellerProofUrl: c.sellerProofUrl,
      adminNotes: c.adminNotes,
      createdAt: c.createdAt,
    }));
  } catch (error) {
    console.error("Failed to get admin complaints:", error);
    return [];
  }
}

export async function updateComplaintStatus(
  complaintId: string,
  data: {
    status: string;
    adminNotes?: string;
    sellerResponse?: string;
    sellerProofUrl?: string;
  }
): Promise<boolean> {
  try {
    await db.complaint.update({
      where: { id: complaintId },
      data: {
        status: data.status,
        adminNotes: data.adminNotes !== undefined ? data.adminNotes : undefined,
        sellerResponse: data.sellerResponse !== undefined ? data.sellerResponse : undefined,
        sellerProofUrl: data.sellerProofUrl !== undefined ? data.sellerProofUrl : undefined,
      },
    });

    // If resolved with refund, update the order status
    if (data.status === "RESOLVED") {
      const complaint = await db.complaint.findUnique({
        where: { id: complaintId },
        select: { orderId: true },
      });
      if (complaint) {
        await db.order.update({
          where: { id: complaint.orderId },
          data: { status: "REFUNDED" },
        });

        await db.orderTimeline.create({
          data: {
            orderId: complaint.orderId,
            status: "REFUNDED",
            description: `Complaint ${complaintId} resolved by admin. Order refund completed.`,
          },
        });
      }
    }

    return true;
  } catch (error) {
    console.error("Failed to update complaint status:", error);
    return false;
  }
}
