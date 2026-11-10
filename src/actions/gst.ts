"use server";

import db from "@/lib/db";
import { verifyAuthenticatedUser } from "@/lib/auth-server";
import { validateGstAndPhone, validateGSTIN, validateIndianMobile } from "@/lib/gstin";
import { getProductById } from "./products";

export interface GstVerificationResponse {
  success: boolean;
  error?: string;
  gstin?: string;
  phone?: string;
  stateName?: string;
  pan?: string;
}

/**
 * Server action to verify GSTIN and mobile number format before submitting or previewing
 */
export async function verifyBuyerGstAndPhoneAction(data: {
  gstin: string;
  phone: string;
}): Promise<GstVerificationResponse> {
  const check = validateGstAndPhone(data.gstin, data.phone);

  if (!check.isValid) {
    return {
      success: false,
      error: check.error || "GSTIN and registered mobile number are required to unlock bulk pricing.",
    };
  }

  return {
    success: true,
    gstin: check.normalizedGstin,
    phone: check.normalizedPhone,
    stateName: check.stateName,
    pan: check.pan,
  };
}

/**
 * Buyer submits GSTIN & Business Name for Super Admin approval before commercial bulk pricing
 */
export async function submitBuyerGstVerificationAction(data: {
  gstin: string;
  businessName: string;
  phone?: string;
}): Promise<{
  success: boolean;
  error?: string;
  gstStatus?: string;
  gstin?: string;
  message?: string;
}> {
  try {
    const auth = await verifyAuthenticatedUser();
    if (!auth.authorized || !auth.userId) {
      return { success: false, error: "Please sign in to submit GST details." };
    }

    const gstinCheck = validateGSTIN(data.gstin);
    if (!gstinCheck.isValid || !gstinCheck.normalizedGstin) {
      return { success: false, error: gstinCheck.error || "Please enter a valid 15-character Indian GSTIN." };
    }

    const businessName = (data.businessName || "").trim();
    if (!businessName || businessName.length < 2) {
      return { success: false, error: "Please enter your registered Business / Company Name." };
    }

    const now = new Date();
    await db.user.update({
      where: { id: auth.userId },
      data: {
        gstin: gstinCheck.normalizedGstin,
        gstBusinessName: businessName,
        gstStatus: "PENDING",
        gstSubmittedAt: now,
        gstRejectionReason: null,
      },
    });

    return {
      success: true,
      gstStatus: "PENDING",
      gstin: gstinCheck.normalizedGstin,
      message: "GST details submitted successfully! Your submission is pending Super Admin review. You can continue purchasing single boxes at standard pricing.",
    };
  } catch (err: any) {
    console.error("submitBuyerGstVerificationAction error:", err);
    return { success: false, error: "An unexpected error occurred while submitting GST verification." };
  }
}

/**
 * Returns the current authenticated buyer's GST status
 */
export async function getBuyerGstStatusAction(): Promise<{
  gstStatus: string; // "NOT_SUBMITTED" | "PENDING" | "APPROVED" | "REJECTED"
  gstin?: string | null;
  gstBusinessName?: string | null;
  gstSubmittedAt?: Date | null;
  gstVerifiedAt?: Date | null;
  gstRejectionReason?: string | null;
  phone?: string | null;
}> {
  try {
    const auth = await verifyAuthenticatedUser();
    if (!auth.authorized || !auth.userId) {
      return { gstStatus: "NOT_SUBMITTED" };
    }

    if (auth.role === "ADMIN") {
      return { gstStatus: "APPROVED" };
    }

    const user = await db.user.findUnique({
      where: { id: auth.userId },
      select: {
        gstStatus: true,
        gstin: true,
        gstBusinessName: true,
        gstSubmittedAt: true,
        gstVerifiedAt: true,
        gstRejectionReason: true,
        phone: true,
        mobileNumber: true,
      },
    });

    if (!user) {
      return { gstStatus: "NOT_SUBMITTED" };
    }

    return {
      gstStatus: user.gstStatus || "NOT_SUBMITTED",
      gstin: user.gstin,
      gstBusinessName: user.gstBusinessName,
      gstSubmittedAt: user.gstSubmittedAt,
      gstVerifiedAt: user.gstVerifiedAt,
      gstRejectionReason: user.gstRejectionReason,
      phone: user.mobileNumber || user.phone,
    };
  } catch (err) {
    console.error("getBuyerGstStatusAction error:", err);
    return { gstStatus: "NOT_SUBMITTED" };
  }
}

/**
 * Admin: Get all buyers with submitted GST applications
 */
export async function adminGetPendingGstBuyersAction(): Promise<{
  success: boolean;
  error?: string;
  buyers: Array<{
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
    mobileNumber: string | null;
    gstin: string | null;
    gstBusinessName: string | null;
    gstStatus: string;
    gstSubmittedAt: Date | null;
    gstVerifiedAt: Date | null;
    gstRejectionReason: string | null;
  }>;
}> {
  try {
    const auth = await verifyAuthenticatedUser();
    if (!auth.authorized || auth.role !== "ADMIN") {
      return { success: false, error: "Super Admin privileges required.", buyers: [] };
    }

    const buyers = await db.user.findMany({
      where: {
        gstStatus: { in: ["PENDING", "APPROVED", "REJECTED"] },
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        mobileNumber: true,
        gstin: true,
        gstBusinessName: true,
        gstStatus: true,
        gstSubmittedAt: true,
        gstVerifiedAt: true,
        gstRejectionReason: true,
      },
      orderBy: { gstSubmittedAt: "desc" },
    });

    return { success: true, buyers };
  } catch (err: any) {
    console.error("adminGetPendingGstBuyersAction error:", err);
    return { success: false, error: "Failed to fetch GST applications.", buyers: [] };
  }
}

/**
 * Admin: Approve buyer GST application
 */
export async function adminApproveBuyerGstAction(userId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const auth = await verifyAuthenticatedUser();
    if (!auth.authorized || auth.role !== "ADMIN") {
      return { success: false, error: "Super Admin privileges required." };
    }

    const now = new Date();
    await db.user.update({
      where: { id: userId },
      data: {
        gstStatus: "APPROVED",
        gstVerifiedAt: now,
        gstRejectionReason: null,
      },
    });

    return { success: true };
  } catch (err: any) {
    console.error("adminApproveBuyerGstAction error:", err);
    return { success: false, error: "Failed to approve GST." };
  }
}

/**
 * Admin: Reject buyer GST application
 */
export async function adminRejectBuyerGstAction(userId: string, reason?: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const auth = await verifyAuthenticatedUser();
    if (!auth.authorized || auth.role !== "ADMIN") {
      return { success: false, error: "Super Admin privileges required." };
    }

    await db.user.update({
      where: { id: userId },
      data: {
        gstStatus: "REJECTED",
        gstRejectionReason: (reason || "Invalid GST details").trim(),
      },
    });

    return { success: true };
  } catch (err: any) {
    console.error("adminRejectBuyerGstAction error:", err);
    return { success: false, error: "Failed to reject GST." };
  }
}

/**
 * Server action: Securely fetch approved bulk pricing for a product.
 * Requires verified GSTIN and Mobile; otherwise only returns base 1-box price.
 */
export async function getApprovedProductPricingAction(data: {
  productId: string;
  gstin?: string;
  phone?: string;
}) {
  const product = await getProductById(data.productId);
  if (!product) {
    return { success: false, error: "Product not found" };
  }

  const oneBoxPrice = product.price || 2.0;
  const unitsPerBox = product.unitsPerBox || 100;

  // Check if GSTIN and Phone are verified
  let isVerified = false;
  if (data.gstin && data.phone) {
    const check = validateGstAndPhone(data.gstin, data.phone);
    if (check.isValid) {
      isVerified = true;
    }
  }

  if (!isVerified) {
    // Return ONLY 1-box price; keep bulk hidden
    return {
      success: true,
      isBulkUnlocked: false,
      oneBoxPrice,
      unitsPerBox,
      message: "Bulk pricing available after GST verification.",
    };
  }

  // Approved bulk pricing for 2+ boxes
  const twoBoxPrice = product.twoBoxPrice !== undefined && product.twoBoxPrice !== null
    ? Number(product.twoBoxPrice)
    : 3.50; // Approved default, NOT ₹4!

  const threePlusBoxPrice = product.threePlusBoxPrice !== undefined && product.threePlusBoxPrice !== null
    ? Number(product.threePlusBoxPrice)
    : 1.60;

  return {
    success: true,
    isBulkUnlocked: true,
    oneBoxPrice,
    unitsPerBox,
    twoBoxPrice,
    threePlusBoxPrice,
    bulkPricingApproved: product.bulkPricingApproved ?? true,
  };
}
