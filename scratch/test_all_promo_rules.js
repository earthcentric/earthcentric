const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

// Import pricing and offer logic
const {
  getEffectiveUnitPrice,
  isIndividualDiscountActive,
  isBuyXGetYActive,
  calculateBuyXGetYFreeItems,
  isTierDiscountActive,
  getProductTiers,
} = require("../src/lib/offers");

async function main() {
  console.log("=== COMPREHENSIVE PROMOTIONS & TOGGLE VERIFICATION ===");

  const baseProduct = {
    price: 259,
    originalPrice: 299,
  };

  // -------------------------------------------------------------
  // Test 1: Individual Discount (ON vs OFF)
  // -------------------------------------------------------------
  console.log("\n--- TEST 1: Individual Discount ---");
  const indivActive = {
    ...baseProduct,
    individualDiscount: {
      enabled: true,
      status: "APPROVED",
      discountType: "PERCENTAGE",
      discountValue: 50,
    },
  };
  const indivDisabled = {
    ...baseProduct,
    individualDiscount: {
      enabled: false,
      discountValue: 0,
    },
  };

  const pIndivActive = getEffectiveUnitPrice(indivActive, 1);
  const pIndivDisabled = getEffectiveUnitPrice(indivDisabled, 1);

  console.log("Indiv Active Unit Price (50% off 259):", pIndivActive.unitPrice, "(Expected: 129.5)");
  console.log("Indiv Active Badge:", pIndivActive.badgeText, "(Expected: 50% OFF)");
  console.log("Indiv Disabled Unit Price:", pIndivDisabled.unitPrice, "(Expected: 259)");
  console.log("Indiv Disabled isIndividualDiscountActive:", isIndividualDiscountActive(indivDisabled.individualDiscount), "(Expected: false)");

  if (pIndivActive.unitPrice === 129.5 && pIndivDisabled.unitPrice === 259 && !isIndividualDiscountActive(indivDisabled.individualDiscount)) {
    console.log("✅ Individual Discount ON/OFF: PASS");
  } else {
    throw new Error("❌ Individual Discount ON/OFF: FAIL");
  }

  // -------------------------------------------------------------
  // Test 2: Tier Volume Discounts (ON vs OFF)
  // -------------------------------------------------------------
  console.log("\n--- TEST 2: Tier Volume Discounts ---");
  const tierActive = {
    ...baseProduct,
    tierDiscounts: {
      enabled: true,
      tiers: [
        { minQuantity: 5, discountType: "PERCENTAGE", discountValue: 10 },
        { minQuantity: 10, discountType: "PERCENTAGE", discountValue: 20 },
      ],
    },
  };
  const tierDisabled = {
    ...baseProduct,
    tierDiscounts: {
      enabled: false,
      tiers: [],
    },
  };

  console.log("isTierDiscountActive(tierActive):", isTierDiscountActive(tierActive.tierDiscounts), "(Expected: true)");
  console.log("getProductTiers(tierActive).length:", getProductTiers(tierActive.tierDiscounts).length, "(Expected: 2)");
  console.log("isTierDiscountActive(tierDisabled):", isTierDiscountActive(tierDisabled.tierDiscounts), "(Expected: false)");
  console.log("getProductTiers(tierDisabled).length:", getProductTiers(tierDisabled.tierDiscounts).length, "(Expected: 0)");

  // Below tier threshold (quantity = 2)
  const pTierQty2 = getEffectiveUnitPrice(tierActive, 2);
  console.log("Tier Active (qty=2, below tier):", pTierQty2.unitPrice, "(Expected: 259)");

  // At tier 1 threshold (quantity = 5, 10% off 259 = 233.1)
  const pTierQty5 = getEffectiveUnitPrice(tierActive, 5);
  console.log("Tier Active (qty=5, 10% off):", pTierQty5.unitPrice, "(Expected: 233.1)");

  // At tier 2 threshold (quantity = 10, 20% off 259 = 207.2)
  const pTierQty10 = getEffectiveUnitPrice(tierActive, 10);
  console.log("Tier Active (qty=10, 20% off):", pTierQty10.unitPrice, "(Expected: 207.2)");

  // When disabled by seller (quantity = 10)
  const pTierDisabledQty10 = getEffectiveUnitPrice(tierDisabled, 10);
  console.log("Tier Disabled (qty=10):", pTierDisabledQty10.unitPrice, "(Expected: 259)");

  if (
    isTierDiscountActive(tierActive.tierDiscounts) === true &&
    isTierDiscountActive(tierDisabled.tierDiscounts) === false &&
    pTierQty2.unitPrice === 259 &&
    Math.round(pTierQty5.unitPrice * 10) === 2331 &&
    Math.round(pTierQty10.unitPrice * 10) === 2072 &&
    pTierDisabledQty10.unitPrice === 259
  ) {
    console.log("✅ Tier Discounts ON/OFF & Quantity Calculation: PASS");
  } else {
    throw new Error("❌ Tier Discounts ON/OFF: FAIL");
  }

  // -------------------------------------------------------------
  // Test 3: Buy X Get Y Free Offer (ON vs OFF)
  // -------------------------------------------------------------
  console.log("\n--- TEST 3: Buy X Get Y Free Offer ---");
  const bxgyActive = {
    enabled: true,
    buyQuantity: 2,
    getQuantity: 1,
    maxFreeQuantity: 3,
  };
  const bxgyDisabled = {
    enabled: false,
  };

  console.log("isBuyXGetYActive(bxgyActive):", isBuyXGetYActive(bxgyActive), "(Expected: true)");
  console.log("isBuyXGetYActive(bxgyDisabled):", isBuyXGetYActive(bxgyDisabled), "(Expected: false)");

  const freeQty1 = calculateBuyXGetYFreeItems(1, bxgyActive);
  const freeQty2 = calculateBuyXGetYFreeItems(2, bxgyActive);
  const freeQty4 = calculateBuyXGetYFreeItems(4, bxgyActive);
  const freeQty8 = calculateBuyXGetYFreeItems(8, bxgyActive); // max free = 3
  const freeQty4Disabled = calculateBuyXGetYFreeItems(4, bxgyDisabled);

  console.log("BXGY qty=1 free items:", freeQty1, "(Expected: 0)");
  console.log("BXGY qty=2 free items:", freeQty2, "(Expected: 1)");
  console.log("BXGY qty=4 free items:", freeQty4, "(Expected: 2)");
  console.log("BXGY qty=8 free items (capped at 3):", freeQty8, "(Expected: 3)");
  console.log("BXGY Disabled qty=4 free items:", freeQty4Disabled, "(Expected: 0)");

  if (
    isBuyXGetYActive(bxgyActive) === true &&
    isBuyXGetYActive(bxgyDisabled) === false &&
    freeQty1 === 0 &&
    freeQty2 === 1 &&
    freeQty4 === 2 &&
    freeQty8 === 3 &&
    freeQty4Disabled === 0
  ) {
    console.log("✅ Buy X Get Y Offer ON/OFF & Free Item Calculation: PASS");
  } else {
    throw new Error("❌ Buy X Get Y Offer ON/OFF: FAIL");
  }

  // -------------------------------------------------------------
  // Test 4: Database Product rithwik Check
  // -------------------------------------------------------------
  console.log("\n--- TEST 4: Live Neon DB Check for rithwik ---");
  const rithwik = await db.product.findUnique({
    where: { id: "cmti7e6860001txv0n7588xy8" },
  });

  console.log("Product Name:", rithwik.name);
  console.log("isApproved:", rithwik.isApproved, "status:", rithwik.status);
  console.log("individualDiscount:", rithwik.individualDiscount);
  console.log("tierDiscounts:", rithwik.tierDiscounts);
  console.log("buyXGetYOffer:", rithwik.buyXGetYOffer);

  console.log("\n=== ALL TESTS PASSED SUCCESSFULLY! ===");
  await db.$disconnect();
}

main().catch((err) => {
  console.error("Test failure:", err);
  process.exit(1);
});
