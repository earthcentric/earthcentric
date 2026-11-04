/**
 * Single source of truth for EarthCentric Box-Based Bulk Pricing Rules
 *
 * Rules:
 * 1. Every box contains exactly 100 pieces.
 * 2. One box is priced at ₹2 by default for existing products.
 * 3. The price for 2 boxes is NOT 2 × ₹2 = ₹4. It comes from seller/Super Admin approved pricing (default ₹3.50).
 * 4. Before GST verification:
 *    - Only the 1-box price (₹2) is visible.
 *    - Quantity is kept at 1 box.
 *    - The total price for 2+ boxes is completely hidden.
 * 5. After GST verification:
 *    - The buyer can add 2 or more boxes.
 *    - The actual approved bulk price for 2 boxes and 3+ boxes is displayed and applied.
 * 6. Backend recalculates final payable amount using approved pricing; never trusts frontend totals.
 */

export interface ProductBoxPricingInput {
  price?: number | null;
  unitsPerBox?: number | null;
  twoBoxPrice?: number | null;
  threePlusBoxPrice?: number | null;
  bulkPricingApproved?: boolean | null;
}

export interface BoxPricingBreakdown {
  isLocked: boolean;
  oneBoxPrice: number;
  unitPrice: number;
  unitsPerBox: number;
  totalUnits: number;
  totalPrice: number;
  effectivePricePerBox: number;
  twoBoxPrice: number;
  threePlusBoxPrice: number;
  savingsAmount: number;
  savingsPercent: number;
}

export function getBoxPricingBreakdown(
  product: ProductBoxPricingInput,
  boxes: number = 1,
  isGstVerified: boolean = false
): BoxPricingBreakdown {
  const boxCount = Math.max(1, Math.round(boxes));
  const unitsPerBox = 100; // Requirement: Every box contains exactly 100 pieces
  const totalUnits = boxCount * unitsPerBox;

  // 1-box default price is ₹2.00
  const oneBoxPrice = product.price !== undefined && product.price !== null && product.price > 0
    ? Number(product.price)
    : 2.0;

  // Approved 2-box price (NOT 2 * oneBoxPrice). Default ₹3.50 if not explicitly configured.
  const twoBoxPrice = product.twoBoxPrice !== undefined && product.twoBoxPrice !== null && product.twoBoxPrice > 0
    ? Number(product.twoBoxPrice)
    : 3.50;

  // Approved 3+ box rate per box (Default ₹1.60/box if not explicitly configured).
  const threePlusBoxPrice = product.threePlusBoxPrice !== undefined && product.threePlusBoxPrice !== null && product.threePlusBoxPrice > 0
    ? Number(product.threePlusBoxPrice)
    : 1.60;

  // If 1 box: always unlocked and visible to everyone
  if (boxCount === 1) {
    return {
      isLocked: false,
      oneBoxPrice,
      unitPrice: oneBoxPrice,
      unitsPerBox,
      totalUnits,
      totalPrice: oneBoxPrice,
      effectivePricePerBox: oneBoxPrice,
      twoBoxPrice,
      threePlusBoxPrice,
      savingsAmount: 0,
      savingsPercent: 0,
    };
  }

  // If 2+ boxes and NOT GST verified: BULK PRICING IS LOCKED AND HIDDEN
  if (!isGstVerified) {
    return {
      isLocked: true,
      oneBoxPrice,
      unitPrice: oneBoxPrice,
      unitsPerBox,
      totalUnits,
      totalPrice: oneBoxPrice, // Fallback safe base; UI hides bulk total
      effectivePricePerBox: oneBoxPrice,
      twoBoxPrice,
      threePlusBoxPrice,
      savingsAmount: 0,
      savingsPercent: 0,
    };
  }

  // If 2+ boxes and GST IS VERIFIED: UNLOCKED APPROVED PRICING
  let totalPrice = 0;
  if (boxCount === 2) {
    totalPrice = twoBoxPrice;
  } else {
    // 3 or more boxes: boxes * threePlusBoxPrice
    totalPrice = Math.round(boxCount * threePlusBoxPrice * 100) / 100;
  }

  const effectivePricePerBox = Math.round((totalPrice / boxCount) * 100) / 100;
  const regularTotal = oneBoxPrice * boxCount;
  const savingsAmount = Math.max(0, Math.round((regularTotal - totalPrice) * 100) / 100);
  const savingsPercent = regularTotal > 0 ? Math.round((savingsAmount / regularTotal) * 100) : 0;

  return {
    isLocked: false,
    oneBoxPrice,
    unitPrice: effectivePricePerBox,
    unitsPerBox,
    totalUnits,
    totalPrice,
    effectivePricePerBox,
    twoBoxPrice,
    threePlusBoxPrice,
    savingsAmount,
    savingsPercent,
  };
}
