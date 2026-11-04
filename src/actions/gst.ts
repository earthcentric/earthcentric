"use server";

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
 * Server action to verify GSTIN and mobile number before unlocking bulk commercial pricing
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

