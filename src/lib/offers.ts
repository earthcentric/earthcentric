import { BuyXGetYOffer, IndividualDiscount, TierDiscount } from "@/actions/products";

/**
 * Checks if a Buy X Get Y offer is currently active based on enabled flag, status, and dates
 */
export function isBuyXGetYActive(offer?: any | null): boolean {
  if (!offer) return false;
  // If explicitly disabled or pending initial approval, not active
  if (offer.enabled === false) return false;
  if (offer.approvalStatus === "PENDING_APPROVAL") return false;
  if (offer.status && offer.status !== "ACTIVE" && offer.status !== "APPROVED") {
    // If it is in deactivation approval, it stays active until super admin approves deactivation
    if (offer.approvalStatus !== "PENDING_DEACTIVATION") {
      return false;
    }
  }

  const buyQty = Number(offer.buyQuantity ?? offer.buyQty ?? 0);
  const getQty = Number(offer.getQuantity ?? offer.getQty ?? 0);
  if (buyQty <= 0 || getQty <= 0) return false;
  
  const now = new Date();
  
  if (offer.startDate && typeof offer.startDate === "string" && offer.startDate.trim() !== "") {
    const start = new Date(offer.startDate);
    if (!isNaN(start.getTime())) {
      start.setHours(0, 0, 0, 0);
      if (offer.approvedAt) {
        const approved = new Date(offer.approvedAt);
        if (now < start && start > approved) return false;
      } else if (now < start) {
        return false;
      }
    }
  }
  
  if (offer.endDate && typeof offer.endDate === "string" && offer.endDate.trim() !== "") {
    const end = new Date(offer.endDate);
    if (!isNaN(end.getTime())) {
      end.setHours(23, 59, 59, 999);
      if (offer.approvedAt) {
        const approved = new Date(offer.approvedAt);
        if (!isNaN(approved.getTime()) && end <= approved) {
          // Stale requested date prior to approval
        } else if (now > end) {
          return false;
        }
      } else if (now > end) {
        return false;
      }
    }
  }
  
  return true;
}

/**
 * Calculates the number of free items earned based on purchased quantity and active offer.
 * Supports either (quantity, offer) or (offer, quantity) invocation signatures.
 */
export function calculateBuyXGetYFreeItems(arg1: any, arg2?: any): number {
  let quantity: number;
  let offer: any;

  if (typeof arg1 === "number") {
    quantity = arg1;
    offer = arg2;
  } else if (typeof arg2 === "number") {
    quantity = arg2;
    offer = arg1;
  } else {
    return 0;
  }

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
  if (!discount) return false;
  // If explicitly disabled or pending initial approval, not active
  if (discount.enabled === false) return false;
  if (discount.approvalStatus === "PENDING_APPROVAL") return false;
  if (discount.status && discount.status !== "ACTIVE" && discount.status !== "APPROVED") {
    // If pending deactivation approval, it stays active for buyers
    if (discount.approvalStatus !== "PENDING_DEACTIVATION") {
      return false;
    }
  }
  const val = Number(discount.discountValue ?? 0);
  if (val <= 0) return false;

  const now = new Date();

  if (discount.startDate && typeof discount.startDate === "string" && discount.startDate.trim() !== "") {
    const start = new Date(discount.startDate);
    if (!isNaN(start.getTime())) {
      start.setHours(0, 0, 0, 0);
      if (discount.approvedAt) {
        const approved = new Date(discount.approvedAt);
        if (now < start && start > approved) return false;
      } else if (now < start) {
        return false;
      }
    }
  }

  if (discount.endDate && typeof discount.endDate === "string" && discount.endDate.trim() !== "") {
    const end = new Date(discount.endDate);
    if (!isNaN(end.getTime())) {
      end.setHours(23, 59, 59, 999);
      // If approved by admin after the requested end date, do not expire based on stale date
      if (discount.approvedAt) {
        const approved = new Date(discount.approvedAt);
        if (!isNaN(approved.getTime()) && end <= approved) {
          // Stale requested end date prior to approval, discount remains valid
        } else if (now > end) {
          return false;
        }
      } else if (now > end) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Checks if a product's Tier Discounts are currently active and enabled.
 */
export function isTierDiscountActive(tierDiscounts?: any | null): boolean {
  if (!tierDiscounts) return false;
  if (Array.isArray(tierDiscounts)) return tierDiscounts.length > 0;
  if (tierDiscounts.enabled === false) return false;
  if (tierDiscounts.approvalStatus === "PENDING_APPROVAL") return false;
  if (tierDiscounts.status && tierDiscounts.status !== "ACTIVE" && tierDiscounts.status !== "APPROVED") {
    // If pending deactivation approval, it stays active for buyers
    if (tierDiscounts.approvalStatus !== "PENDING_DEACTIVATION") {
      return false;
    }
  }
  const tiers = Array.isArray(tierDiscounts.tiers) ? tierDiscounts.tiers : [];
  return tiers.length > 0;
}

/**
 * Extracts the list of active tiers from a product's tierDiscounts field.
 */
export function getProductTiers(tierDiscounts?: any | null): TierDiscount[] {
  if (!tierDiscounts) return [];
  if (Array.isArray(tierDiscounts)) return tierDiscounts;
  if (tierDiscounts.enabled === false) return [];
  if (tierDiscounts.approvalStatus === "PENDING_APPROVAL") return [];
  return Array.isArray(tierDiscounts.tiers) ? tierDiscounts.tiers : [];
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
    bulkPriceSlabs?: any | null;
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

    indivPrice = Math.round(indivPrice * 100) / 100;

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
  if (isTierDiscountActive(product.tierDiscounts)) {
    const rawTiers = getProductTiers(product.tierDiscounts);
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

      tierPrice = Math.round(tierPrice * 100) / 100;

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

  // 3. Check Bulk Wholesale Slabs
  if (product.bulkPriceSlabs && Array.isArray(product.bulkPriceSlabs)) {
    for (const slab of product.bulkPriceSlabs) {
      const minQty = Number(slab.minQty ?? 0);
      const maxQty = slab.maxQty !== null && slab.maxQty !== undefined ? Number(slab.maxQty) : Infinity;
      if (quantity >= minQty && quantity <= maxQty) {
        const slabPrice = Number(slab.pricePerUnit);
        if (slabPrice < bestUnitPrice) {
          bestUnitPrice = slabPrice;
          appliedType = "TIER";
          badgeText = `Bulk ₹${slabPrice}/unit`;
        }
      }
    }
  }

  // Price calculations:
  // When an individual or tier promotion discount is applied, it was calculated off `basePrice`.
  // Therefore, the strikethrough original price MUST be `basePrice` so the calculation
  // (e.g. ₹259 - 20% = ₹207.2) is 100% proper and matches the seller portal preview!
  let displayOriginalPrice = basePrice;
  if (appliedType === "NONE") {
    // When no discount is applied, show product.originalPrice (MRP) if greater than selling price
    if (product.originalPrice && Number(product.originalPrice) > basePrice) {
      displayOriginalPrice = Number(product.originalPrice);
    }
    discountPercentage = 0;
  } else {
    // Seller promotional discount is active! Reference price is basePrice
    displayOriginalPrice = basePrice;
  }

  const discountAmountPerItem = Math.max(0, Math.round((displayOriginalPrice - bestUnitPrice) * 100) / 100);

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
