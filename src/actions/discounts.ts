"use server";

import db from "@/lib/db";
import { revalidatePath } from "next/cache";
import { createNotification, createAdminNotification } from "@/actions/notifications";

export type DiscountTypeEnum = "INDIVIDUAL" | "TIER" | "BUY_X_GET_Y";
export type DiscountActionEnum = "ACTIVATE" | "DEACTIVATE" | "UPDATE";
export type ApprovalStatusEnum = "PENDING" | "APPROVED" | "REJECTED";

export interface IndividualDiscountConfig {
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: number;
  startDate?: string | null;
  endDate?: string | null;
}

export interface TierDiscountItem {
  minQuantity: number;
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: number;
}

export interface TierDiscountsConfig {
  tiers: TierDiscountItem[];
}

export interface BuyXGetYConfig {
  buyQuantity: number;
  getQuantity: number;
  maxFreeQuantity?: number | null;
  startDate?: string | null;
  endDate?: string | null;
}

export interface DiscountApprovalRequestItem {
  id: string;
  sellerId: string;
  sellerName: string;
  productId: string;
  productName: string;
  productPrice: number;
  originalPrice: number;
  discountType: DiscountTypeEnum;
  requestedAction: DiscountActionEnum;
  status: ApprovalStatusEnum;
  proposedConfig: any;
  currentConfig: any | null;
  rejectionReason?: string | null;
  requestedBy?: string | null;
  reviewedBy?: string | null;
  requestedAt: Date | string;
  reviewedAt?: Date | string | null;
}

// In-memory fallback storage when DB is mock or unavailable
let mockApprovalRequests: DiscountApprovalRequestItem[] = [];

/**
 * Helper to resolve the user ID associated with a seller
 */
async function resolveSellerUserId(sellerId: string): Promise<string | null> {
  try {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock")) {
      return sellerId;
    }
    const user = await db.user.findUnique({
      where: { id: sellerId },
      select: { id: true },
    });
    if (user) return user.id;

    const seller = await db.seller.findFirst({
      where: {
        OR: [
          { id: sellerId },
          { userId: sellerId },
        ],
      },
      select: { userId: true },
    });
    return seller?.userId || sellerId;
  } catch {
    return sellerId;
  }
}

/**
 * Validates discount configuration before creating a request
 */
function validateDiscountConfig(
  discountType: DiscountTypeEnum,
  config: any,
  productPrice: number
): { valid: boolean; error?: string } {
  if (!config) {
    return { valid: false, error: "Discount configuration is required." };
  }

  if (discountType === "INDIVIDUAL") {
    const val = Number(config.discountValue);
    if (isNaN(val) || val <= 0) {
      return { valid: false, error: "Individual discount value must be greater than 0." };
    }
    if (config.discountType === "PERCENTAGE" && val > 100) {
      return { valid: false, error: "Percentage discount cannot exceed 100%." };
    }
    if (config.discountType === "FIXED" && val >= productPrice) {
      return { valid: false, error: "Fixed discount cannot exceed or equal the product price." };
    }
  } else if (discountType === "TIER") {
    const tiers = Array.isArray(config.tiers) ? config.tiers : [];
    if (tiers.length === 0) {
      return { valid: false, error: "At least one discount tier is required." };
    }
    for (const t of tiers) {
      const minQty = Number(t.minQuantity);
      const val = Number(t.discountValue);
      if (isNaN(minQty) || minQty < 2) {
        return { valid: false, error: "Tier minimum quantity must be at least 2 units." };
      }
      if (isNaN(val) || val <= 0) {
        return { valid: false, error: "Tier discount value must be greater than 0." };
      }
      if (t.discountType === "PERCENTAGE" && val > 100) {
        return { valid: false, error: "Tier percentage discount cannot exceed 100%." };
      }
      if (t.discountType === "FIXED" && val >= productPrice) {
        return { valid: false, error: "Tier fixed discount cannot exceed or equal the product price." };
      }
    }
  } else if (discountType === "BUY_X_GET_Y") {
    const buyQty = Number(config.buyQuantity ?? config.buyQty);
    const getQty = Number(config.getQuantity ?? config.getQty);
    if (isNaN(buyQty) || buyQty < 1) {
      return { valid: false, error: "Buy quantity (X) must be at least 1." };
    }
    if (isNaN(getQty) || getQty < 1) {
      return { valid: false, error: "Get quantity (Y) must be at least 1." };
    }
  }

  return { valid: true };
}

/**
 * Closes and turns off a discount immediately on the product.
 * Automatically removes the discount from the marketplace and sends a notification
 * to the Super Admin that the discount has been closed for this product and brand.
 */
export async function closeDiscountImmediately(params: {
  productId: string;
  sellerId: string;
  discountType: DiscountTypeEnum;
  closedBy?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { productId, sellerId, discountType, closedBy } = params;
    const isMock = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");

    let product: any = null;
    let sellerName = "Seller";

    if (!isMock) {
      product = await db.product.findUnique({
        where: { id: productId },
        include: { seller: true },
      });
      if (!product) {
        return { success: false, error: "Product not found." };
      }
      if (product.sellerId !== sellerId) {
        return { success: false, error: "Unauthorized: You do not own this product." };
      }
      sellerName = product.seller?.companyName || "Seller";

      const now = new Date();
      const updatePayload: any = {};

      if (discountType === "INDIVIDUAL") {
        const existing = (product.individualDiscount as any) || {};
        updatePayload.individualDiscount = {
          ...existing,
          enabled: false,
          status: "INACTIVE",
          approvalStatus: "NONE",
          pendingRequestId: null,
          pendingConfig: null,
          rejectionReason: null,
          closedAt: now.toISOString(),
          closedBy: closedBy || sellerId,
        };
      } else if (discountType === "TIER") {
        const existing = (product.tierDiscounts as any) || {};
        updatePayload.tierDiscounts = {
          ...existing,
          enabled: false,
          status: "INACTIVE",
          approvalStatus: "NONE",
          pendingRequestId: null,
          pendingConfig: null,
          rejectionReason: null,
          closedAt: now.toISOString(),
          closedBy: closedBy || sellerId,
        };
      } else if (discountType === "BUY_X_GET_Y") {
        const existing = (product.buyXGetYOffer as any) || {};
        updatePayload.buyXGetYOffer = {
          ...existing,
          enabled: false,
          status: "INACTIVE",
          approvalStatus: "NONE",
          pendingRequestId: null,
          pendingConfig: null,
          rejectionReason: null,
          closedAt: now.toISOString(),
          closedBy: closedBy || sellerId,
        };
      }

      await db.product.update({
        where: { id: productId },
        data: updatePayload,
      });

      // Close any pending approval requests for this product & discountType
      await (db as any).discountApprovalRequest.updateMany({
        where: {
          productId,
          discountType,
          status: "PENDING",
        },
        data: {
          status: "REJECTED",
          rejectionReason: `Closed directly by seller (${sellerName})`,
          reviewedAt: now,
        },
      });
    } else {
      sellerName = "Seller";
    }

    const productName = product?.name?.trim() || "Product";
    const discountTypeLabel =
      discountType === "INDIVIDUAL"
        ? "individual product discount"
        : discountType === "TIER"
        ? "tier discounts"
        : "Buy X Get Y offer";

    // Notify Super Admin that the discount has been closed of this product from this particular brand
    await createAdminNotification(
      `Discount Closed: ${productName}`,
      `The ${discountTypeLabel} has been closed for "${productName}" from brand "${sellerName}".`,
      "/admin/dashboard?tab=promotions"
    ).catch(() => {});

    try {
      revalidatePath("/");
      revalidatePath("/marketplace");
      revalidatePath(`/products/${productId}`);
      revalidatePath("/seller/dashboard");
      revalidatePath("/admin/dashboard");
    } catch {}

    return { success: true };
  } catch (error: any) {
    console.error("closeDiscountImmediately error:", error);
    return { success: false, error: error.message || "Failed to close discount." };
  }
}

/**
 * 1. SELLER CREATES AN APPROVAL REQUEST
 * Supports: ACTIVATE, DEACTIVATE, UPDATE for INDIVIDUAL, TIER, and BUY_X_GET_Y
 */
export async function requestDiscountApproval(params: {
  productId: string;
  sellerId: string;
  discountType: DiscountTypeEnum;
  requestedAction: DiscountActionEnum;
  proposedConfig: any;
  requestedBy?: string;
}): Promise<{ success: boolean; error?: string; requestId?: string }> {
  try {
    const { productId, sellerId, discountType, requestedAction, proposedConfig, requestedBy } = params;

    const isMock = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");

    // Fetch product to verify ownership and existing state
    let product: any = null;
    let sellerName = "Seller";

    if (!isMock) {
      product = await db.product.findUnique({
        where: { id: productId },
        include: { seller: true },
      });
      if (!product) {
        return { success: false, error: "Product not found." };
      }
      if (product.sellerId !== sellerId) {
        return { success: false, error: "Unauthorized: You do not own this product." };
      }
      sellerName = product.seller?.companyName || "Seller";
    }

    const price = product ? Number(product.price) : 259;

    // Validate configuration only if action is ACTIVATE or UPDATE
    if (requestedAction === "ACTIVATE" || requestedAction === "UPDATE") {
      const valRes = validateDiscountConfig(discountType, proposedConfig, price);
      if (!valRes.valid) {
        return { success: false, error: valRes.error };
      }
    }

    // Check for existing pending request for this product & discountType to prevent duplicates (Requirement 17)
    if (!isMock) {
      const existingPending = await (db as any).discountApprovalRequest.findFirst({
        where: {
          productId,
          discountType,
          status: "PENDING",
        },
      });

      if (existingPending) {
        return {
          success: false,
          error: "An approval request is already pending for this discount. Please wait for Super Admin review.",
        };
      }
    } else {
      const existingPending = mockApprovalRequests.find(
        (r) => r.productId === productId && r.discountType === discountType && r.status === "PENDING"
      );
      if (existingPending) {
        return {
          success: false,
          error: "An approval request is already pending for this discount. Please wait for Super Admin review.",
        };
      }
    }

    // Get current configuration snapshot
    let currentConfig: any = null;
    if (product) {
      if (discountType === "INDIVIDUAL") currentConfig = product.individualDiscount;
      else if (discountType === "TIER") currentConfig = product.tierDiscounts;
      else if (discountType === "BUY_X_GET_Y") currentConfig = product.buyXGetYOffer;
    }

    // Determine target approval status label
    let targetApprovalStatus: string = "PENDING_APPROVAL";
    if (requestedAction === "DEACTIVATE") {
      targetApprovalStatus = "PENDING_DEACTIVATION";
    } else if (requestedAction === "UPDATE") {
      targetApprovalStatus = "PENDING_UPDATE";
    }

    let createdRequestId = `req-${Date.now()}`;

    if (!isMock) {
      const createdRequest = await (db as any).discountApprovalRequest.create({
        data: {
          sellerId,
          productId,
          discountType,
          requestedAction,
          status: "PENDING",
          proposedConfig: proposedConfig || {},
          currentConfig: currentConfig || null,
          requestedBy: requestedBy || sellerId,
          requestedAt: new Date(),
        },
      });
      createdRequestId = createdRequest.id;

      // Update product's discount field to register the pending request
      // CRITICAL RULE: NEVER CHANGE LIVE 'enabled' or 'status' DURING A REQUEST!
      const updatePayload: any = {};

      if (discountType === "INDIVIDUAL") {
        const existingIndiv = (product.individualDiscount as any) || {};
        if (requestedAction === "DEACTIVATE") {
          // Keep current live discount ACTIVE for buyers until admin approves
          updatePayload.individualDiscount = {
            ...existingIndiv,
            approvalStatus: targetApprovalStatus,
            pendingRequestId: createdRequestId,
            rejectionReason: null,
            enabled: true,
            status: "ACTIVE",
          };
        } else if (requestedAction === "UPDATE") {
          // Keep current live discount active with old config, store proposed in pendingConfig
          updatePayload.individualDiscount = {
            ...existingIndiv,
            approvalStatus: targetApprovalStatus,
            pendingRequestId: createdRequestId,
            pendingConfig: proposedConfig,
            rejectionReason: null,
            enabled: true,
            status: "ACTIVE",
          };
        } else {
          // ACTIVATION: Keep discount OFF/INACTIVE for buyers until admin approves
          updatePayload.individualDiscount = {
            ...existingIndiv,
            approvalStatus: targetApprovalStatus,
            pendingRequestId: createdRequestId,
            pendingConfig: proposedConfig,
            rejectionReason: null,
            enabled: false,
            status: "INACTIVE",
            discountType: proposedConfig?.discountType || existingIndiv.discountType || "PERCENTAGE",
            discountValue: proposedConfig?.discountValue !== undefined ? Number(proposedConfig.discountValue) : existingIndiv.discountValue,
            startDate: proposedConfig?.startDate ?? existingIndiv.startDate ?? null,
            endDate: proposedConfig?.endDate ?? existingIndiv.endDate ?? null,
          };
        }
      } else if (discountType === "TIER") {
        const existingTier = (product.tierDiscounts as any) || {};
        if (requestedAction === "DEACTIVATE") {
          // Keep current tier discounts ACTIVE for buyers
          updatePayload.tierDiscounts = {
            ...existingTier,
            approvalStatus: targetApprovalStatus,
            pendingRequestId: createdRequestId,
            rejectionReason: null,
            enabled: true,
            status: "ACTIVE",
          };
        } else if (requestedAction === "UPDATE") {
          // Keep current live tiers active, store proposed in pendingConfig
          updatePayload.tierDiscounts = {
            ...existingTier,
            approvalStatus: targetApprovalStatus,
            pendingRequestId: createdRequestId,
            pendingConfig: proposedConfig,
            rejectionReason: null,
            enabled: true,
            status: "ACTIVE",
          };
        } else {
          // ACTIVATION: Keep tier discounts OFF/INACTIVE for buyers
          updatePayload.tierDiscounts = {
            ...existingTier,
            approvalStatus: targetApprovalStatus,
            pendingRequestId: createdRequestId,
            pendingConfig: proposedConfig,
            rejectionReason: null,
            enabled: false,
            status: "INACTIVE",
            tiers: proposedConfig?.tiers || existingTier.tiers || [],
          };
        }
      } else if (discountType === "BUY_X_GET_Y") {
        const existingBxgy = (product.buyXGetYOffer as any) || {};
        if (requestedAction === "DEACTIVATE") {
          // Keep current Buy X Get Y offer ACTIVE for buyers
          updatePayload.buyXGetYOffer = {
            ...existingBxgy,
            approvalStatus: targetApprovalStatus,
            pendingRequestId: createdRequestId,
            rejectionReason: null,
            enabled: true,
            status: "ACTIVE",
          };
        } else if (requestedAction === "UPDATE") {
          // Keep current live offer active, store proposed in pendingConfig
          updatePayload.buyXGetYOffer = {
            ...existingBxgy,
            approvalStatus: targetApprovalStatus,
            pendingRequestId: createdRequestId,
            pendingConfig: proposedConfig,
            rejectionReason: null,
            enabled: true,
            status: "ACTIVE",
          };
        } else {
          // ACTIVATION: Keep Buy X Get Y offer OFF/INACTIVE for buyers
          updatePayload.buyXGetYOffer = {
            ...existingBxgy,
            approvalStatus: targetApprovalStatus,
            pendingRequestId: createdRequestId,
            pendingConfig: proposedConfig,
            rejectionReason: null,
            enabled: false,
            status: "INACTIVE",
            buyQuantity: proposedConfig?.buyQuantity ?? existingBxgy.buyQuantity ?? 2,
            getQuantity: proposedConfig?.getQuantity ?? existingBxgy.getQuantity ?? 1,
            maxFreeQuantity: proposedConfig?.maxFreeQuantity ?? existingBxgy.maxFreeQuantity ?? null,
            startDate: proposedConfig?.startDate ?? existingBxgy.startDate ?? null,
            endDate: proposedConfig?.endDate ?? existingBxgy.endDate ?? null,
          };
        }
      }

      await db.product.update({
        where: { id: productId },
        data: updatePayload,
      });
    } else {
      mockApprovalRequests.unshift({
        id: createdRequestId,
        sellerId,
        sellerName,
        productId,
        productName: product?.name || "Product",
        productPrice: price,
        originalPrice: product?.originalPrice || price,
        discountType,
        requestedAction,
        status: "PENDING",
        proposedConfig: proposedConfig || {},
        currentConfig: currentConfig || null,
        requestedBy: requestedBy || sellerId,
        requestedAt: new Date(),
      });
    }

    // Friendly labels for notification messages
    const discountTypeLabel =
      discountType === "INDIVIDUAL"
        ? "Individual Product Discount"
        : discountType === "TIER"
        ? "Tier Discounts"
        : "Buy X Get Y Free Offer";

    // 1. Notify Super Admin
    let adminMsg = `New ${discountTypeLabel} requires approval from Seller: ${sellerName}`;
    if (requestedAction === "DEACTIVATE") {
      adminMsg = `Seller ${sellerName} has requested to deactivate ${discountTypeLabel}.`;
    } else if (requestedAction === "UPDATE") {
      adminMsg = `Seller ${sellerName} has requested to update ${discountTypeLabel}.`;
    }

    await createAdminNotification(
      `Discount ${requestedAction === "ACTIVATE" ? "Activation" : requestedAction === "DEACTIVATE" ? "Deactivation" : "Update"} Request`,
      adminMsg,
      "/admin/dashboard?tab=discounts"
    ).catch(() => {});

    // 2. Notify Seller
    const sellerUserId = await resolveSellerUserId(sellerId);
    let sellerMsg = "Your discount has been submitted for Super Admin approval.";
    if (requestedAction === "DEACTIVATE") {
      sellerMsg = "Your request to deactivate the discount has been submitted for approval.";
    } else if (requestedAction === "UPDATE") {
      sellerMsg = "Your discount update request has been submitted for approval.";
    }

    if (sellerUserId) {
      await createNotification(
        sellerUserId,
        `Discount Request Submitted ⏳`,
        sellerMsg,
        "/seller/dashboard?tab=products"
      ).catch(() => {});
    }

    try {
      revalidatePath("/");
      revalidatePath("/marketplace");
      revalidatePath(`/products/${productId}`);
      revalidatePath("/seller/dashboard");
      revalidatePath("/admin/dashboard");
    } catch {}

    return { success: true, requestId: createdRequestId };
  } catch (error: any) {
    console.error("requestDiscountApproval error:", error);
    return { success: false, error: error.message || "Failed to submit discount approval request." };
  }
}

/**
 * 2. SUPER ADMIN APPROVES A DISCOUNT REQUEST
 */
export async function approveDiscountRequest(
  requestId: string,
  adminEmail: string = "admin@earthcentric.com"
): Promise<{ success: boolean; error?: string }> {
  try {
    const isMock = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");

    let reqItem: any = null;

    if (!isMock) {
      reqItem = await (db as any).discountApprovalRequest.findUnique({
        where: { id: requestId },
        include: {
          product: {
            include: { seller: true },
          },
          seller: true,
        },
      });
    } else {
      reqItem = mockApprovalRequests.find((r) => r.id === requestId);
    }

    if (!reqItem) {
      return { success: false, error: "Discount approval request not found." };
    }

    if (reqItem.status !== "PENDING") {
      return { success: false, error: `This request has already been ${reqItem.status.toLowerCase()}.` };
    }

    const { productId, sellerId, discountType, requestedAction, proposedConfig } = reqItem;
    const now = new Date();

    const discountTypeLabel =
      discountType === "INDIVIDUAL"
        ? "Individual Product Discount"
        : discountType === "TIER"
        ? "Tier Discounts"
        : "Buy X Get Y Free Offer";

    if (!isMock) {
      // 1. Update Request record to APPROVED
      await (db as any).discountApprovalRequest.update({
        where: { id: requestId },
        data: {
          status: "APPROVED",
          reviewedBy: adminEmail,
          reviewedAt: now,
        },
      });

      // 2. Update Product's discount field to ACTIVE / INACTIVE depending on action
      const product = await db.product.findUnique({ where: { id: productId } });
      if (!product) return { success: false, error: "Product not found." };

      const updatePayload: any = {};

      if (discountType === "INDIVIDUAL") {
        if (requestedAction === "ACTIVATE" || requestedAction === "UPDATE") {
          let safeEndDate = proposedConfig?.endDate || null;
          if (safeEndDate) {
            const parsed = new Date(safeEndDate);
            if (!isNaN(parsed.getTime())) {
              parsed.setHours(23, 59, 59, 999);
              if (parsed < now) safeEndDate = null;
            }
          }
          updatePayload.individualDiscount = {
            enabled: true,
            status: "ACTIVE",
            approvalStatus: "APPROVED",
            discountType: proposedConfig?.discountType || "PERCENTAGE",
            discountValue: Number(proposedConfig?.discountValue || 0),
            startDate: proposedConfig?.startDate || null,
            endDate: safeEndDate,
            approvedBy: adminEmail,
            approvedAt: now.toISOString(),
            pendingRequestId: null,
            pendingConfig: null,
            rejectionReason: null,
          };
        } else if (requestedAction === "DEACTIVATE") {
          const current = (product.individualDiscount as any) || {};
          updatePayload.individualDiscount = {
            ...current,
            enabled: false,
            status: "INACTIVE",
            approvalStatus: "APPROVED",
            approvedBy: adminEmail,
            approvedAt: now.toISOString(),
            pendingRequestId: null,
            pendingConfig: null,
            rejectionReason: null,
          };
        }
      } else if (discountType === "TIER") {
        if (requestedAction === "ACTIVATE" || requestedAction === "UPDATE") {
          updatePayload.tierDiscounts = {
            enabled: true,
            status: "ACTIVE",
            approvalStatus: "APPROVED",
            tiers: proposedConfig?.tiers || [],
            approvedBy: adminEmail,
            approvedAt: now.toISOString(),
            pendingRequestId: null,
            pendingConfig: null,
            rejectionReason: null,
          };
        } else if (requestedAction === "DEACTIVATE") {
          const current = (product.tierDiscounts as any) || {};
          updatePayload.tierDiscounts = {
            ...current,
            enabled: false,
            status: "INACTIVE",
            approvalStatus: "APPROVED",
            approvedBy: adminEmail,
            approvedAt: now.toISOString(),
            pendingRequestId: null,
            pendingConfig: null,
            rejectionReason: null,
          };
        }
      } else if (discountType === "BUY_X_GET_Y") {
        if (requestedAction === "ACTIVATE" || requestedAction === "UPDATE") {
          let safeEndDate = proposedConfig?.endDate || null;
          if (safeEndDate) {
            const parsed = new Date(safeEndDate);
            if (!isNaN(parsed.getTime())) {
              parsed.setHours(23, 59, 59, 999);
              if (parsed < now) safeEndDate = null;
            }
          }
          updatePayload.buyXGetYOffer = {
            enabled: true,
            status: "ACTIVE",
            approvalStatus: "APPROVED",
            buyQuantity: Number(proposedConfig?.buyQuantity ?? 2),
            getQuantity: Number(proposedConfig?.getQuantity ?? 1),
            maxFreeQuantity: proposedConfig?.maxFreeQuantity ? Number(proposedConfig.maxFreeQuantity) : null,
            startDate: proposedConfig?.startDate || null,
            endDate: safeEndDate,
            approvedBy: adminEmail,
            approvedAt: now.toISOString(),
            pendingRequestId: null,
            pendingConfig: null,
            rejectionReason: null,
          };
        } else if (requestedAction === "DEACTIVATE") {
          const current = (product.buyXGetYOffer as any) || {};
          updatePayload.buyXGetYOffer = {
            ...current,
            enabled: false,
            status: "INACTIVE",
            approvalStatus: "APPROVED",
            approvedBy: adminEmail,
            approvedAt: now.toISOString(),
            pendingRequestId: null,
            pendingConfig: null,
            rejectionReason: null,
          };
        }
      }

      await db.product.update({
        where: { id: productId },
        data: updatePayload,
      });

      // 3. Log Audit
      await db.auditLog.create({
        data: {
          action: `APPROVE_DISCOUNT_${requestedAction}_${discountType}`,
          adminEmail,
          details: JSON.stringify({
            requestId,
            productId,
            sellerId,
            discountType,
            requestedAction,
          }),
        },
      });
    } else {
      reqItem.status = "APPROVED";
      reqItem.reviewedBy = adminEmail;
      reqItem.reviewedAt = now;
    }

    // 4. Send Notification to Seller
    const sellerUserId = await resolveSellerUserId(sellerId);
    let sellerNotifMsg = "";

    if (requestedAction === "ACTIVATE") {
      sellerNotifMsg = `Your ${discountTypeLabel} has been approved and is now active.`;
    } else if (requestedAction === "DEACTIVATE") {
      sellerNotifMsg = `Your discount deactivation has been approved. The discount is now inactive.`;
    } else if (requestedAction === "UPDATE") {
      sellerNotifMsg = `Your ${discountTypeLabel} update has been approved and is now active.`;
    }

    if (sellerUserId) {
      await createNotification(
        sellerUserId,
        `${discountTypeLabel} Approved 🎉`,
        sellerNotifMsg,
        "/seller/dashboard?tab=products"
      ).catch(() => {});
    }

    try {
      revalidatePath("/");
      revalidatePath("/marketplace");
      revalidatePath(`/products/${productId}`);
      revalidatePath("/seller/dashboard");
      revalidatePath("/admin/dashboard");
    } catch {}

    return { success: true };
  } catch (error: any) {
    console.error("approveDiscountRequest error:", error);
    return { success: false, error: error.message || "Failed to approve discount request." };
  }
}

/**
 * 3. SUPER ADMIN REJECTS A DISCOUNT REQUEST
 */
export async function rejectDiscountRequest(
  requestId: string,
  rejectionReason?: string,
  adminEmail: string = "admin@earthcentric.com"
): Promise<{ success: boolean; error?: string }> {
  try {
    const isMock = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");

    let reqItem: any = null;

    if (!isMock) {
      reqItem = await (db as any).discountApprovalRequest.findUnique({
        where: { id: requestId },
        include: {
          product: {
            include: { seller: true },
          },
          seller: true,
        },
      });
    } else {
      reqItem = mockApprovalRequests.find((r) => r.id === requestId);
    }

    if (!reqItem) {
      return { success: false, error: "Discount approval request not found." };
    }

    if (reqItem.status !== "PENDING") {
      return { success: false, error: `This request has already been ${reqItem.status.toLowerCase()}.` };
    }

    const { productId, sellerId, discountType, requestedAction } = reqItem;
    const now = new Date();

    const discountTypeLabel =
      discountType === "INDIVIDUAL"
        ? "Individual Product Discount"
        : discountType === "TIER"
        ? "Tier Discounts"
        : "Buy X Get Y Free Offer";

    if (!isMock) {
      // 1. Update Request record to REJECTED
      await (db as any).discountApprovalRequest.update({
        where: { id: requestId },
        data: {
          status: "REJECTED",
          rejectionReason: rejectionReason || "Criteria not met.",
          reviewedBy: adminEmail,
          reviewedAt: now,
        },
      });

      // 2. Update Product's discount field
      // CRITICAL RULES:
      // If ACTIVATE rejected: live status remains INACTIVE (enabled: false).
      // If DEACTIVATE rejected: live status MUST REMAIN ACTIVE (enabled: true)!
      // If UPDATE rejected: live status MUST REMAIN ACTIVE with existing config!
      const product = await db.product.findUnique({ where: { id: productId } });
      if (!product) return { success: false, error: "Product not found." };

      const updatePayload: any = {};

      if (discountType === "INDIVIDUAL") {
        const current = (product.individualDiscount as any) || {};
        if (requestedAction === "ACTIVATE") {
          updatePayload.individualDiscount = {
            ...current,
            enabled: false,
            status: "INACTIVE",
            approvalStatus: "REJECTED",
            rejectionReason: rejectionReason || null,
            rejectedBy: adminEmail,
            rejectedAt: now.toISOString(),
            pendingRequestId: null,
            pendingConfig: null,
          };
        } else if (requestedAction === "DEACTIVATE") {
          // Discount REMAIN ACTIVE!
          updatePayload.individualDiscount = {
            ...current,
            enabled: true,
            status: "ACTIVE",
            approvalStatus: "APPROVED",
            rejectionReason: rejectionReason ? `Deactivation rejected: ${rejectionReason}` : null,
            rejectedBy: adminEmail,
            rejectedAt: now.toISOString(),
            pendingRequestId: null,
            pendingConfig: null,
          };
        } else if (requestedAction === "UPDATE") {
          // Keep old configuration active
          updatePayload.individualDiscount = {
            ...current,
            enabled: true,
            status: "ACTIVE",
            approvalStatus: "APPROVED",
            rejectionReason: rejectionReason ? `Update rejected: ${rejectionReason}` : null,
            rejectedBy: adminEmail,
            rejectedAt: now.toISOString(),
            pendingRequestId: null,
            pendingConfig: null,
          };
        }
      } else if (discountType === "TIER") {
        const current = (product.tierDiscounts as any) || {};
        if (requestedAction === "ACTIVATE") {
          updatePayload.tierDiscounts = {
            ...current,
            enabled: false,
            status: "INACTIVE",
            approvalStatus: "REJECTED",
            rejectionReason: rejectionReason || null,
            rejectedBy: adminEmail,
            rejectedAt: now.toISOString(),
            pendingRequestId: null,
            pendingConfig: null,
          };
        } else if (requestedAction === "DEACTIVATE") {
          // Discount REMAIN ACTIVE!
          updatePayload.tierDiscounts = {
            ...current,
            enabled: true,
            status: "ACTIVE",
            approvalStatus: "APPROVED",
            rejectionReason: rejectionReason ? `Deactivation rejected: ${rejectionReason}` : null,
            rejectedBy: adminEmail,
            rejectedAt: now.toISOString(),
            pendingRequestId: null,
            pendingConfig: null,
          };
        } else if (requestedAction === "UPDATE") {
          // Keep old configuration active
          updatePayload.tierDiscounts = {
            ...current,
            enabled: true,
            status: "ACTIVE",
            approvalStatus: "APPROVED",
            rejectionReason: rejectionReason ? `Update rejected: ${rejectionReason}` : null,
            rejectedBy: adminEmail,
            rejectedAt: now.toISOString(),
            pendingRequestId: null,
            pendingConfig: null,
          };
        }
      } else if (discountType === "BUY_X_GET_Y") {
        const current = (product.buyXGetYOffer as any) || {};
        if (requestedAction === "ACTIVATE") {
          updatePayload.buyXGetYOffer = {
            ...current,
            enabled: false,
            status: "INACTIVE",
            approvalStatus: "REJECTED",
            rejectionReason: rejectionReason || null,
            rejectedBy: adminEmail,
            rejectedAt: now.toISOString(),
            pendingRequestId: null,
            pendingConfig: null,
          };
        } else if (requestedAction === "DEACTIVATE") {
          // Discount REMAIN ACTIVE!
          updatePayload.buyXGetYOffer = {
            ...current,
            enabled: true,
            status: "ACTIVE",
            approvalStatus: "APPROVED",
            rejectionReason: rejectionReason ? `Deactivation rejected: ${rejectionReason}` : null,
            rejectedBy: adminEmail,
            rejectedAt: now.toISOString(),
            pendingRequestId: null,
            pendingConfig: null,
          };
        } else if (requestedAction === "UPDATE") {
          // Keep old configuration active
          updatePayload.buyXGetYOffer = {
            ...current,
            enabled: true,
            status: "ACTIVE",
            approvalStatus: "APPROVED",
            rejectionReason: rejectionReason ? `Update rejected: ${rejectionReason}` : null,
            rejectedBy: adminEmail,
            rejectedAt: now.toISOString(),
            pendingRequestId: null,
            pendingConfig: null,
          };
        }
      }

      await db.product.update({
        where: { id: productId },
        data: updatePayload,
      });

      // 3. Log Audit
      await db.auditLog.create({
        data: {
          action: `REJECT_DISCOUNT_${requestedAction}_${discountType}`,
          adminEmail,
          details: JSON.stringify({
            requestId,
            productId,
            sellerId,
            discountType,
            requestedAction,
            rejectionReason,
          }),
        },
      });
    } else {
      reqItem.status = "REJECTED";
      reqItem.rejectionReason = rejectionReason || "Criteria not met.";
      reqItem.reviewedBy = adminEmail;
      reqItem.reviewedAt = now;
    }

    // 4. Send Notification to Seller
    const sellerUserId = await resolveSellerUserId(sellerId);
    let sellerNotifMsg = "";

    if (requestedAction === "ACTIVATE") {
      sellerNotifMsg = `Your ${discountTypeLabel} request was rejected by Super Admin.${rejectionReason ? ` Reason: ${rejectionReason}` : ""}`;
    } else if (requestedAction === "DEACTIVATE") {
      sellerNotifMsg = `Your discount deactivation request was rejected by Super Admin. The discount remains active.${rejectionReason ? ` Reason: ${rejectionReason}` : ""}`;
    } else if (requestedAction === "UPDATE") {
      sellerNotifMsg = `Your discount update request was rejected by Super Admin. The previous discount remains active.${rejectionReason ? ` Reason: ${rejectionReason}` : ""}`;
    }

    if (sellerUserId) {
      await createNotification(
        sellerUserId,
        `${discountTypeLabel} Request Rejected ⚠️`,
        sellerNotifMsg,
        "/seller/dashboard?tab=products"
      ).catch(() => {});
    }

    try {
      revalidatePath("/");
      revalidatePath("/marketplace");
      revalidatePath(`/products/${productId}`);
      revalidatePath("/seller/dashboard");
      revalidatePath("/admin/dashboard");
    } catch {}

    return { success: true };
  } catch (error: any) {
    console.error("rejectDiscountRequest error:", error);
    return { success: false, error: error.message || "Failed to reject discount request." };
  }
}

/**
 * 4. GET ALL DISCOUNT APPROVAL REQUESTS (For Super Admin Dashboard & Audit Trail)
 */
export async function getAllDiscountApprovalRequests(filter?: {
  status?: "PENDING" | "APPROVED" | "REJECTED" | "ALL";
  sellerId?: string;
  productId?: string;
}): Promise<DiscountApprovalRequestItem[]> {
  try {
    const isMock = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");

    if (!isMock) {
      const where: any = {};
      if (filter?.status && filter.status !== "ALL") {
        where.status = filter.status;
      }
      if (filter?.sellerId) {
        where.sellerId = filter.sellerId;
      }
      if (filter?.productId) {
        where.productId = filter.productId;
      }

      const dbRequests = await (db as any).discountApprovalRequest.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              price: true,
              originalPrice: true,
            },
          },
          seller: {
            select: {
              id: true,
              companyName: true,
            },
          },
        },
        orderBy: { requestedAt: "desc" },
      });

      return dbRequests.map((r: any) => ({
        id: r.id,
        sellerId: r.sellerId,
        sellerName: r.seller?.companyName || "Seller",
        productId: r.productId,
        productName: r.product?.name || "Product",
        productPrice: r.product?.price || 0,
        originalPrice: r.product?.originalPrice || r.product?.price || 0,
        discountType: r.discountType,
        requestedAction: r.requestedAction,
        status: r.status,
        proposedConfig: r.proposedConfig,
        currentConfig: r.currentConfig,
        rejectionReason: r.rejectionReason,
        requestedBy: r.requestedBy,
        reviewedBy: r.reviewedBy,
        requestedAt: r.requestedAt,
        reviewedAt: r.reviewedAt,
      }));
    }

    let filtered = [...mockApprovalRequests];
    if (filter?.status && filter.status !== "ALL") {
      filtered = filtered.filter((r) => r.status === filter.status);
    }
    if (filter?.sellerId) {
      filtered = filtered.filter((r) => r.sellerId === filter.sellerId);
    }
    if (filter?.productId) {
      filtered = filtered.filter((r) => r.productId === filter.productId);
    }

    return filtered.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
  } catch (error) {
    console.error("getAllDiscountApprovalRequests error:", error);
    return [];
  }
}

/**
 * 5. GET PENDING DISCOUNT APPROVAL REQUESTS COUNT & LIST
 */
export async function getPendingDiscountApprovalRequests(): Promise<DiscountApprovalRequestItem[]> {
  return getAllDiscountApprovalRequests({ status: "PENDING" });
}

/**
 * 6. GET AUDIT HISTORY FOR A SPECIFIC PRODUCT OR SELLER
 */
export async function getDiscountAuditHistory(
  productId?: string,
  sellerId?: string
): Promise<DiscountApprovalRequestItem[]> {
  return getAllDiscountApprovalRequests({ productId, sellerId });
}
