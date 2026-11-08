import assert from "node:assert/strict";
import test from "node:test";
import { calculateCheckoutLine } from "../src/lib/checkout-pricing.ts";

test("keeps product selling price, seller base, and commission separate", () => {
  const line = calculateCheckoutLine({
    price: 120,
    twoBoxPrice: 240,
    threePlusBoxPrice: 80,
    unitsPerBox: 10,
    bulkOrderQuantity: null,
    commissionRate: 20,
    sellerBasePrice: 100,
  }, 2);

  assert.equal(line.itemTotal, 240);
  assert.equal(line.sellerBaseAmount, 200);
  assert.equal(line.commissionAmount, 40);
  assert.equal(line.sellerNetAmount, 200);
  assert.equal(line.totalUnits, 20);
});
