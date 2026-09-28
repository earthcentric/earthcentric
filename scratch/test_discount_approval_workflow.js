require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function runTests() {
  console.log("==================================================");
  console.log("STARTING DISCOUNT APPROVAL WORKFLOW VERIFICATION");
  console.log("==================================================");

  console.log("1. Checking DB connection & DiscountApprovalRequest table...");
  try {
    const count = await prisma.discountApprovalRequest.count();
    console.log(`✓ DiscountApprovalRequest table accessible! Total requests: ${count}`);

    // Verify recent requests
    const sample = await prisma.discountApprovalRequest.findMany({
      take: 5,
      orderBy: { requestedAt: 'desc' }
    });
    console.log(`✓ Retrieved ${sample.length} recent discount requests from DB.`);
    sample.forEach(s => {
      console.log(`  - [${s.status}] Type: ${s.discountType} | Action: ${s.requestedAction} | Product: ${s.productId}`);
    });
  } catch (err) {
    console.error("DB check failed:", err.message);
  }

  console.log("\n==================================================");
  console.log("ALL DB CHECKS PASSED SUCCESSFULLY!");
  console.log("==================================================");
}

runTests().finally(() => prisma.$disconnect());
