import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

async function main() {
  // Production protection check
  if (process.env.NODE_ENV === "production" && process.env.RESET_DATABASE_CONFIRM !== "true") {
    console.error("CRITICAL ERROR: Cannot reset database in production unless RESET_DATABASE_CONFIRM=true is set.");
    process.exit(1);
  }

  console.log("Starting database cleanup...");

  // Delete records in order of foreign key dependency
  try {
    console.log("Deleting Enquiries & Complaints...");
    await prisma.enquiry.deleteMany();
    await prisma.complaint.deleteMany();

    console.log("Deleting Messages & System Credentials...");
    await prisma.message.deleteMany();
    await prisma.systemCredential.deleteMany();

    console.log("Deleting Wishlists & Carts...");
    await prisma.wishlistItem.deleteMany();
    await prisma.wishlist.deleteMany();
    await prisma.cartItem.deleteMany();
    await prisma.cart.deleteMany();

    console.log("Deleting Orders & Payments...");
    await prisma.orderItem.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.orderTimeline.deleteMany();
    await prisma.order.deleteMany();

    console.log("Deleting Reviews & Payouts...");
    await prisma.review.deleteMany();
    await prisma.payoutRequest.deleteMany();

    console.log("Deleting Seller Documents & Profiles...");
    await prisma.sellerDocument.deleteMany();
    await prisma.seller.deleteMany();

    console.log("Deleting Products & Images...");
    await prisma.productImage.deleteMany();
    await prisma.productCertification.deleteMany();
    await prisma.product.deleteMany();

    console.log("Deleting Base Data (Categories, Addresses, Audits, Notifications)...");
    await prisma.category.deleteMany();
    await prisma.certification.deleteMany();
    await prisma.address.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.auditLog.deleteMany();

    console.log("Deleting Users...");
    await prisma.user.deleteMany();

    console.log("Seeding Superadmin User...");
    const adminEmail = process.env.SUPERADMIN_EMAIL || "admin@earthcentric.com";
    const adminPassword = process.env.SUPERADMIN_PASSWORD || "Admin@123";
    const hashedPassword = hashPassword(adminPassword);

    await prisma.user.create({
      data: {
        name: "EarthCentric Admin",
        email: adminEmail,
        password: hashedPassword,
        role: "ADMIN",
      },
    });

    console.log("Seeding Base Categories...");
    const categories = [
      { name: "Organic Apparel", slug: "organic-apparel", description: "Ethical spun organic fiber garments." },
      { name: "Zero-Waste Living", slug: "zero-waste-living", description: "Zero single-use plastics lifestyle essentials." },
      { name: "Renewable Energy", slug: "renewable-energy", description: "Solar powered portable electronics and devices." },
      { name: "Eco Home Goods", slug: "eco-home-goods", description: "Furniture and tableware repurposed from architectural waste and reclaimed timber." },
    ];

    for (const cat of categories) {
      await prisma.category.create({ data: cat });
    }

    console.log("\n==============================================");
    console.log("DATABASE RESET SUCCESSFULLY!");
    console.log("Created Superadmin account:");
    console.log(`- Email: ${adminEmail}`);
    console.log(`- Password: ${adminPassword}`);
    console.log("==============================================");
  } catch (error) {
    console.error("Database cleanup failed:", error);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
