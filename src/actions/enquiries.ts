"use server";

import db from "@/lib/db";
import { createNotification, createAdminNotification } from "@/actions/notifications";

export interface EnquiryData {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  quantity: number;
  targetPrice?: number | null;
  location: string;
  expectedDate?: Date | null;
  name: string;
  email: string;
  phone: string;
  message?: string | null;
  status: string;
  createdAt: Date;
  buyerId?: string | null;
}

let mockEnquiries: (EnquiryData & { buyerId?: string | null })[] = [];

export async function createEnquiry(data: {
  productId: string;
  buyerId?: string;
  quantity: number;
  targetPrice?: number;
  location: string;
  expectedDate?: Date;
  name: string;
  email: string;
  phone: string;
  message?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    let productName = "Bulk Product";
    let productSlug = data.productId;
    let sellerUserId: string | undefined;

    const isMock = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");

    if (!isMock) {
      const product = await db.product.findUnique({
        where: { id: data.productId },
        include: { seller: { select: { userId: true } } },
      });

      if (product) {
        productName = product.name;
        productSlug = product.slug;
        sellerUserId = product.seller.userId;
      }

      await db.enquiry.create({
        data: {
          productId: data.productId,
          buyerId: data.buyerId || null,
          quantity: Number(data.quantity),
          targetPrice: data.targetPrice ? Number(data.targetPrice) : null,
          location: data.location,
          expectedDate: data.expectedDate ? new Date(data.expectedDate) : null,
          name: data.name,
          email: data.email,
          phone: data.phone,
          message: data.message || null,
        },
      });
    } else {
      const newEnq: EnquiryData = {
        id: `enq-${Date.now()}`,
        productId: data.productId,
        productName: "Eco Organic Product",
        productSlug: data.productId,
        quantity: Number(data.quantity),
        targetPrice: data.targetPrice ? Number(data.targetPrice) : null,
        location: data.location,
        expectedDate: data.expectedDate ? new Date(data.expectedDate) : null,
        name: data.name,
        email: data.email,
        phone: data.phone,
        message: data.message || null,
        status: "PENDING",
        createdAt: new Date(),
        buyerId: data.buyerId || null,
      };
      mockEnquiries.unshift(newEnq);
      productName = newEnq.productName;
    }

    // 1. Buyer Notification
    if (data.buyerId) {
      await createNotification(
        data.buyerId,
        "Bulk Order Quote Request Sent 📦",
        `Your bulk order quote request for "${productName}" (${data.quantity} units) has been submitted successfully to the manufacturer. Status: PENDING.`,
        `/products/${data.productId}`
      );
    }

    // 2. Seller Notification (only send to seller if seller is a distinct user from the buyer)
    if (sellerUserId && sellerUserId !== data.buyerId) {
      await createNotification(
        sellerUserId,
        "New Bulk Quote Enquiry 💼",
        `You received a new bulk order quote enquiry from ${data.name} for "${productName}" (${data.quantity} units).`,
        `/seller/dashboard?tab=enquiries`
      );
    }

    // 3. Super Admin Notification
    await createAdminNotification(
      "New Wholesale Quote Enquiry 💼",
      `A new bulk order quote request was submitted by ${data.name} for ${data.quantity} units.`,
      "enquiries"
    );

    return { success: true };
  } catch (error) {
    console.error("Failed to create enquiry:", error);
    return { success: false, error: "Failed to submit bulk quote request." };
  }
}

export async function getSellerEnquiries(sellerId: string): Promise<EnquiryData[]> {
  try {
    const isMock = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");

    if (isMock) {
      return mockEnquiries;
    }

    const products = await db.product.findMany({
      where: { sellerId },
      select: { id: true },
    });

    const productIds = products.map((p) => p.id);

    const enquiries = await db.enquiry.findMany({
      where: {
        productId: { in: productIds },
      },
      include: {
        product: {
          select: { name: true, slug: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return enquiries.map((e) => ({
      id: e.id,
      productId: e.productId,
      productName: e.product.name,
      productSlug: e.product.slug,
      quantity: e.quantity,
      targetPrice: e.targetPrice,
      location: e.location,
      expectedDate: e.expectedDate,
      name: e.name,
      email: e.email,
      phone: e.phone,
      message: e.message,
      status: e.status,
      createdAt: e.createdAt,
      buyerId: e.buyerId,
    }));
  } catch (error) {
    console.error("Failed to get seller enquiries:", error);
    return mockEnquiries;
  }
}

export async function updateEnquiryStatus(
  enquiryId: string,
  status: string,
  proposedDate?: string,
  extensionNote?: string
): Promise<boolean> {
  try {
    const isMock = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");

    let buyerId: string | null | undefined;
    let productName = "Product";
    let productId = "";

    if (!isMock) {
      const enq = await db.enquiry.findUnique({
        where: { id: enquiryId },
        include: { product: { select: { name: true, id: true } } },
      });

      if (enq) {
        buyerId = enq.buyerId;
        productName = enq.product.name;
        productId = enq.productId;
      }

      await db.enquiry.update({
        where: { id: enquiryId },
        data: { status },
      });
    } else {
      const mockEnq = mockEnquiries.find((e) => e.id === enquiryId);
      if (mockEnq) {
        mockEnq.status = status;
        buyerId = mockEnq.buyerId;
        productName = mockEnq.productName;
        productId = mockEnq.productId;
      }
    }

    // Send status update notification to buyer based on seller option selected
    if (buyerId) {
      const upperStatus = status.toUpperCase();
      if (upperStatus === "APPROVED" || upperStatus === "ACCEPTED") {
        await createNotification(
          buyerId,
          "Bulk Order Quote Approved! ✅",
          `Great news! Your bulk order quote request for "${productName}" has been APPROVED by the seller.`,
          `/products/${productId}`
        );
      } else if (upperStatus === "REJECTED" || upperStatus === "DECLINED") {
        await createNotification(
          buyerId,
          "Bulk Order Quote Declined ❌",
          `Your bulk order quote request for "${productName}" was declined by the seller.`,
          `/products/${productId}`
        );
      } else if (upperStatus === "EXTEND_DELIVERY_DATE" || upperStatus === "EXTENSION_REQUESTED") {
        const formattedDate = proposedDate ? new Date(proposedDate).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "a later date";
        const noteText = extensionNote ? ` Note: ${extensionNote}` : "";

        await createNotification(
          buyerId,
          "Delivery Date Extension Requested 📅",
          `The seller has requested to extend the delivery date for your bulk order quote of "${productName}" to ${formattedDate}.${noteText}`,
          `/products/${productId}`
        );
      } else {
        await createNotification(
          buyerId,
          `Bulk Order Quote Status: ${status} 📋`,
          `Your bulk order quote request for "${productName}" status was updated to ${status}.`,
          `/products/${productId}`
        );
      }
    }

    return true;
  } catch (error) {
    console.error("Failed to update enquiry status:", error);
    return false;
  }
}
