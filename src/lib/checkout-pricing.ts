import type { Product } from "@prisma/client";

export function calculateCheckoutLine(product: Product, boxQuantity: number) {
  const unitsPerBox = product.unitsPerBox || product.bulkOrderQuantity || 100;
  const oneBoxPrice = Math.max(0, Number(product.price ?? 2));
  const twoBoxPrice = Math.max(0, Number(product.twoBoxPrice ?? 3.5));
  const threePlusBoxPrice = Math.max(0, Number(product.threePlusBoxPrice ?? 1.6));
  const rawTotal = boxQuantity === 1
    ? oneBoxPrice
    : boxQuantity === 2
      ? twoBoxPrice
      : boxQuantity * threePlusBoxPrice;
  const itemTotal = Math.round(rawTotal * 100) / 100;
  const unitPrice = Math.round((itemTotal / boxQuantity) * 100) / 100;
  const commissionRate = product.commissionRate ?? 20;
  const sellerBasePrice = product.sellerBasePrice ??
    (product.price
      ? Math.round((Number(product.price) / (1 + commissionRate / 100)) * 100) / 100
      : 80);
  const commissionAmount = Math.round(
    (sellerBasePrice * (commissionRate / 100) * boxQuantity) * 100
  ) / 100;
  const sellerNetAmount = Math.round((itemTotal - commissionAmount) * 100) / 100;

  return {
    unitsPerBox,
    totalUnits: boxQuantity * unitsPerBox,
    unitPrice,
    itemTotal,
    commissionRate,
    sellerBasePrice,
    sellerBaseAmount: Math.round(sellerBasePrice * boxQuantity * 100) / 100,
    commissionAmount,
    sellerNetAmount,
  };
}
