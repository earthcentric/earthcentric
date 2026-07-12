"use server";

import db from "@/lib/db";

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
}

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

    return { success: true };
  } catch (error) {
    console.error("Failed to create enquiry:", error);
    return { success: false, error: "Failed to submit bulk quote request." };
  }
}

export async function getSellerEnquiries(sellerId: string): Promise<EnquiryData[]> {
  try {
    // Find seller's products first
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
    }));
  } catch (error) {
    console.error("Failed to get seller enquiries:", error);
    return [];
  }
}

export async function updateEnquiryStatus(enquiryId: string, status: string): Promise<boolean> {
  try {
    await db.enquiry.update({
      where: { id: enquiryId },
      data: { status },
    });
    return true;
  } catch (error) {
    console.error("Failed to update enquiry status:", error);
    return false;
  }
}
