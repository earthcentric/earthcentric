import { BuyXGetYOffer, IndividualDiscount, TierDiscount } from "@/actions/products";

/**
 * Checks if a Buy X Get Y offer is currently active based on enabled flag and dates
 */
export function isBuyXGetYActive(offer?: any | null): boolean {
  if (!offer || offer.enabled === false) return false;
  const buyQty = Number(offer.buyQuantity ?? offer.buyQty ?? 0);
  const getQty = Number(offer.getQuantity ?? offer.getQty ?? 0);
  if (buyQty <= 0 || getQty <= 0) return false;
  
  const now = new Date();
  
  if (offer.startDate) {
    const start = new Date(offer.startDate);
    start.setHours(0, 0, 0, 0);
    if (now < start) return false;
  }
  
  if (offer.endDate) {
    const end = new Date(offer.endDate);
    end.setHours(23, 59, 59, 999);
    if (now > end) return false;
  }
  
  return true;
}

/**
 * Calculates the number of free items earned based on purchased quantity and active offer
 */
export function calculateBuyXGetYFreeItems(quantity: number, offer?: any | null): number {
  if (!isBuyXGetYActive(offer)) return 0;
  
  const buyQty = Number(offer.buyQuantity ?? offer.buyQty ?? 0);
  const getQty = Number(offer.getQuantity ?? offer.getQty ?? 0);
  
  if (buyQty <= 0 || getQty <= 0) return 0;
  
  const sets = Math.floor(quantity / buyQty);
  let freeItems = sets * getQty;
  
  const maxFree = Number(offer.maxFreeQuantity ?? offer.maxFree ?? 0);
  if (maxFree > 0) {
    freeItems = Math.min(freeItems, maxFree);
  }
  
  return freeItems;
}

/**
 * Convenience helper to calculate BXGY offer directly from a product object
 */
export function calculateBXGYOffer(
  product: { buyXGetYOffer?: any | null } | null | undefined,
  quantity: number
): { freeQuantity: number; active: boolean } {
  const offer = product?.buyXGetYOffer;
  const active = isBuyXGetYActive(offer);
  const freeQuantity = calculateBuyXGetYFreeItems(quantity, offer);
  return { freeQuantity, active };
}

/**
 * Checks if an Individual Product Discount is currently active and approved.
 */
export function isIndividualDiscountActive(discount?: any | null): boolean {
  if (!discount || discount.enabled === false) return false;
  if (discount.status && discount.status !== "APPROVED") {
    return false;
  }
  const val = Number(discount.discountValue ?? 0);
  if (val <= 0) return false;

  const now = new Date();

  if (discount.startDate) {
    const start = new Date(discount.startDate);
    start.setHours(0, 0, 0, 0);
    if (now < start) return false;
  }

  if (discount.endDate) {
    const end = new Date(discount.endDate);
    end.setHours(23, 59, 59, 999);
    if (now > end) return false;
  }

  return true;
}

/**
 * Calculates the unit price for a product based on priority rules:
 * - Individual Product Discount applies to all quantities if approved and active.
 * - Tier Discount applies when quantity threshold is met.
 * - Compares eligible unit discounts and applies the one giving the best savings (prevents double discounting).
 */
export function getEffectiveUnitPrice(
  product: {
    price: number;
    originalPrice?: number;
    individualDiscount?: any | null;
    tierDiscounts?: any | null;
  },
  quantity: number = 1
): {
  unitPrice: number;
  originalPrice: number;
  discountAmountPerItem: number;
  discountPercentage: number;
  appliedDiscountType: "INDIVIDUAL" | "TIER" | "NONE";
  appliedRule: "INDIVIDUAL" | "TIER" | "NONE";
  badgeText?: string;
} {
  const basePrice = Number(product.price);
  let bestUnitPrice = basePrice;
  let appliedType: "INDIVIDUAL" | "TIER" | "NONE" = "NONE";
  let badgeText: string | undefined = undefined;
  let discountPercentage = 0;

  // 1. Check Individual Product Discount (Applies to all quantities if active & approved)
  if (isIndividualDiscountActive(product.individualDiscount)) {
    const disc = product.individualDiscount!;
    let indivPrice = basePrice;
    let indivPct = 0;
    if (disc.discountType === "PERCENTAGE") {
      indivPct = Number(disc.discountValue);
      indivPrice = Math.max(0, basePrice - (basePrice * indivPct) / 100);
    } else if (disc.discountType === "FIXED") {
      const fixedVal = Number(disc.discountValue);
      indivPrice = Math.max(0, basePrice - fixedVal);
      indivPct = basePrice > 0 ? Math.round((fixedVal / basePrice) * 100) : 0;
    }

    if (indivPrice < bestUnitPrice) {
      bestUnitPrice = indivPrice;
      appliedType = "INDIVIDUAL";
      discountPercentage = indivPct;
      badgeText = disc.discountType === "PERCENTAGE" 
        ? `${disc.discountValue}% OFF` 
        : `Save ₹${disc.discountValue}`;
    }
  }

  // 2. Check Tier Discounts (Applies when quantity threshold met)
  const tierConfig = product.tierDiscounts as any;
  const isTierEnabled = tierConfig ? tierConfig.enabled !== false : true;
  const rawTiers: any[] = Array.isArray(product.tierDiscounts)
    ? product.tierDiscounts
    : (tierConfig?.tiers && Array.isArray(tierConfig.tiers) ? tierConfig.tiers : []);

  if (isTierEnabled && rawTiers.length > 0) {
    const eligibleTiers = rawTiers.filter(t => quantity >= Number(t.minQuantity));
    for (const tier of eligibleTiers) {
      let tierPrice = basePrice;
      let tierPct = 0;
      if (tier.discountType === "PERCENTAGE") {
        tierPct = Number(tier.discountValue);
        tierPrice = Math.max(0, basePrice - (basePrice * tierPct) / 100);
      } else if (tier.discountType === "FIXED") {
        const fixedVal = Number(tier.discountValue);
        tierPrice = Math.max(0, basePrice - fixedVal);
        tierPct = basePrice > 0 ? Math.round((fixedVal / basePrice) * 100) : 0;
      }

      if (tierPrice < bestUnitPrice) {
        bestUnitPrice = tierPrice;
        appliedType = "TIER";
        discountPercentage = tierPct;
        badgeText = tier.discountType === "PERCENTAGE" 
          ? `Bulk ${tier.discountValue}% OFF` 
          : `Bulk Save ₹${tier.discountValue}`;
      }
    }
  }

  // If no Individual or Tier discount is active, do not report a promotion discount percentage
  let displayOriginalPrice = basePrice;
  if (appliedType === "NONE") {
    if (product.originalPrice && Number(product.originalPrice) > basePrice) {
      displayOriginalPrice = Number(product.originalPrice);
    }
    discountPercentage = 0;
  } else {
    // When a seller discount IS applied (INDIVIDUAL or TIER):
    // Reference original price is basePrice (or product.originalPrice if defined)
    displayOriginalPrice = product.originalPrice && Number(product.originalPrice) > basePrice ? Number(product.originalPrice) : basePrice;
  }

  const discountAmountPerItem = Math.max(0, displayOriginalPrice - bestUnitPrice);

  return {
    unitPrice: bestUnitPrice,
    originalPrice: displayOriginalPrice,
    discountAmountPerItem,
    discountPercentage,
    appliedDiscountType: appliedType,
    appliedRule: appliedType,
    badgeText,
  };
}
