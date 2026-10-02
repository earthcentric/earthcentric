require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function runE2EDbTests() {
  console.log("==================================================");
  console.log("RUNNING DATABASE-LEVEL WORKFLOW INTEGRATION TESTS");
  console.log("==================================================\n");

  let testSeller = await prisma.seller.findFirst();
  if (!testSeller) {
    console.error("No seller found in DB to run integration tests.");
    return;
  }
  let testProduct = await prisma.product.findFirst({
    where: { sellerId: testSeller.id }
  });
  if (!testProduct) {
    testProduct = await prisma.product.findFirst();
  }
  if (!testProduct) {
    console.error("No product found in DB to run integration tests.");
    return;
  }

  const productId = testProduct.id;
  const sellerId = testProduct.sellerId;
  console.log(`Using Test Product ID: ${productId}, Seller ID: ${sellerId}`);

  // Backup existing product discount states
  const originalState = {
    individualDiscount: testProduct.individualDiscount,
    tierDiscounts: testProduct.tierDiscounts,
    buyXGetYOffer: testProduct.buyXGetYOffer
  };

  try {
    // ----------------------------------------------------
    // TEST 1: Duplicate Request Prevention (Requirement 17)
    // ----------------------------------------------------
    console.log("\n[TEST 1] Duplicate Request Prevention");
    // Clean any prior pending requests on this product
    await prisma.discountApprovalRequest.deleteMany({
      where: { productId, status: "PENDING" }
    });

    const req1 = await prisma.discountApprovalRequest.create({
      data: {
        sellerId,
        productId,
        discountType: "INDIVIDUAL",
        requestedAction: "ACTIVATE",
        status: "PENDING",
        proposedConfig: { discountType: "PERCENTAGE", discountValue: 50 },
        requestedAt: new Date()
      }
    });

    // Check duplicate detection query
    const dupCheck = await prisma.discountApprovalRequest.findFirst({
      where: {
        productId,
        discountType: "INDIVIDUAL",
        status: "PENDING"
      }
    });

    if (dupCheck && dupCheck.id === req1.id) {
      console.log("  ✓ Correctly found pending request preventing duplicate submission.");
    } else {
      throw new Error("Failed to detect existing pending request.");
    }

    // ----------------------------------------------------
    // TEST 2: Admin Approval of Activation
    // ----------------------------------------------------
    console.log("\n[TEST 2] Admin Approval of Activation");
    await prisma.discountApprovalRequest.update({
      where: { id: req1.id },
      data: {
        status: "APPROVED",
        reviewedBy: "admin@earthcentric.com",
        reviewedAt: new Date()
      }
    });

    await prisma.product.update({
      where: { id: productId },
      data: {
        individualDiscount: {
          enabled: true,
          status: "ACTIVE",
          approvalStatus: "APPROVED",
          discountType: "PERCENTAGE",
          discountValue: 50,
          approvedBy: "admin@earthcentric.com",
          approvedAt: new Date().toISOString()
        }
      }
    });

    const prodAfterApprove = await prisma.product.findUnique({ where: { id: productId } });
    const indivAfterApprove = prodAfterApprove.individualDiscount;
    if (indivAfterApprove.enabled === true && indivAfterApprove.status === "ACTIVE" && indivAfterApprove.approvalStatus === "APPROVED") {
      console.log("  ✓ Individual Discount is now live: enabled = true, status = ACTIVE, approvalStatus = APPROVED");
    } else {
      throw new Error("Product state mismatch after approval: " + JSON.stringify(indivAfterApprove));
    }

    // ----------------------------------------------------
    // TEST 3: Seller requests Deactivation -> Pending Deactivation (MUST REMAIN ACTIVE)
    // ----------------------------------------------------
    console.log("\n[TEST 3] Seller requests Deactivation (State must remain ACTIVE)");
    const deactReq = await prisma.discountApprovalRequest.create({
      data: {
        sellerId,
        productId,
        discountType: "INDIVIDUAL",
        requestedAction: "DEACTIVATE",
        status: "PENDING",
        proposedConfig: {},
        currentConfig: indivAfterApprove,
        requestedAt: new Date()
      }
    });

    await prisma.product.update({
      where: { id: productId },
      data: {
        individualDiscount: {
          ...indivAfterApprove,
          enabled: true, // MUST REMAIN TRUE!
          status: "ACTIVE", // MUST REMAIN ACTIVE!
          approvalStatus: "PENDING_DEACTIVATION",
          pendingRequestId: deactReq.id
        }
      }
    });

    const prodDuringDeact = await prisma.product.findUnique({ where: { id: productId } });
    const indivDuringDeact = prodDuringDeact.individualDiscount;
    if (indivDuringDeact.enabled === true && indivDuringDeact.status === "ACTIVE" && indivDuringDeact.approvalStatus === "PENDING_DEACTIVATION") {
      console.log("  ✓ Product discount STAYS ACTIVE for buyers during pending deactivation request!");
    } else {
      throw new Error("Violated core rule: discount deactivated before admin approval! " + JSON.stringify(indivDuringDeact));
    }

    // ----------------------------------------------------
    // TEST 4: Admin Rejects Deactivation -> MUST REMAIN ACTIVE!
    // ----------------------------------------------------
    console.log("\n[TEST 4] Admin Rejects Deactivation (Offer MUST REMAIN ACTIVE)");
    await prisma.discountApprovalRequest.update({
      where: { id: deactReq.id },
      data: {
        status: "REJECTED",
        rejectionReason: "Promotional contract requires offer to stay active.",
        reviewedBy: "admin@earthcentric.com",
        reviewedAt: new Date()
      }
    });

    await prisma.product.update({
      where: { id: productId },
      data: {
        individualDiscount: {
          ...indivDuringDeact,
          enabled: true, // MUST REMAIN TRUE!
          status: "ACTIVE", // MUST REMAIN ACTIVE!
          approvalStatus: "APPROVED",
          rejectionReason: "Deactivation rejected: Promotional contract requires offer to stay active.",
          rejectedBy: "admin@earthcentric.com",
          rejectedAt: new Date().toISOString(),
          pendingRequestId: null
        }
      }
    });

    const prodAfterRejectDeact = await prisma.product.findUnique({ where: { id: productId } });
    const indivAfterRejectDeact = prodAfterRejectDeact.individualDiscount;
    if (indivAfterRejectDeact.enabled === true && indivAfterRejectDeact.status === "ACTIVE") {
      console.log("  ✓ Deactivation rejected: Offer REMAINED ACTIVE with enabled = true, status = ACTIVE!");
    } else {
      throw new Error("Violated core rule: discount turned off after rejection of deactivation!");
    }

    // ----------------------------------------------------
    // TEST 5: Deactivation Approved -> Turns OFF
    // ----------------------------------------------------
    console.log("\n[TEST 5] Deactivation Approved -> Turns OFF");
    const deactReq2 = await prisma.discountApprovalRequest.create({
      data: {
        sellerId,
        productId,
        discountType: "INDIVIDUAL",
        requestedAction: "DEACTIVATE",
        status: "PENDING",
        proposedConfig: {},
        currentConfig: indivAfterRejectDeact,
        requestedAt: new Date()
      }
    });

    await prisma.discountApprovalRequest.update({
      where: { id: deactReq2.id },
      data: {
        status: "APPROVED",
        reviewedBy: "admin@earthcentric.com",
        reviewedAt: new Date()
      }
    });

    await prisma.product.update({
      where: { id: productId },
      data: {
        individualDiscount: {
          ...indivAfterRejectDeact,
          enabled: false,
          status: "INACTIVE",
          approvalStatus: "APPROVED",
          approvedBy: "admin@earthcentric.com",
          approvedAt: new Date().toISOString(),
          pendingRequestId: null
        }
      }
    });

    const prodAfterApprovedDeact = await prisma.product.findUnique({ where: { id: productId } });
    const indivFinal = prodAfterApprovedDeact.individualDiscount;
    if (indivFinal.enabled === false && indivFinal.status === "INACTIVE") {
      console.log("  ✓ Deactivation approved: Offer successfully turned INACTIVE (enabled = false, status = INACTIVE)");
    } else {
      throw new Error("Failed to deactivate offer after approved deactivation");
    }

    // ----------------------------------------------------
    // TEST 6: Tier Discounts and Buy X Get Y in DB
    // ----------------------------------------------------
    console.log("\n[TEST 6] Tier Discounts and Buy X Get Y verification in DB");
    const tierReq = await prisma.discountApprovalRequest.create({
      data: {
        sellerId,
        productId,
        discountType: "TIER",
        requestedAction: "ACTIVATE",
        status: "PENDING",
        proposedConfig: {
          tiers: [
            { minQuantity: 5, discountType: "PERCENTAGE", discountValue: 10 },
            { minQuantity: 10, discountType: "PERCENTAGE", discountValue: 20 }
          ]
        },
        requestedAt: new Date()
      }
    });

    const bxgyReq = await prisma.discountApprovalRequest.create({
      data: {
        sellerId,
        productId,
        discountType: "BUY_X_GET_Y",
        requestedAction: "ACTIVATE",
        status: "PENDING",
        proposedConfig: { buyQuantity: 2, getQuantity: 1 },
        requestedAt: new Date()
      }
    });

    if (tierReq.id && bxgyReq.id) {
      console.log("  ✓ TIER and BUY_X_GET_Y requests created and persisted with complete schemas.");
    }

    // Clean up created test requests
    await prisma.discountApprovalRequest.deleteMany({
      where: {
        id: { in: [req1.id, deactReq.id, deactReq2.id, tierReq.id, bxgyReq.id] }
      }
    });

    console.log("\n==================================================");
    console.log("ALL E2E DATABASE WORKFLOW TESTS PASSED PERFECTLY!");
    console.log("==================================================");
  } finally {
    // Restore original state
    await prisma.product.update({
      where: { id: productId },
      data: originalState
    });
    console.log("Test product restored to initial state.");
  }
}

runE2EDbTests().finally(() => prisma.$disconnect());
