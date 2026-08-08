import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

async function main() {
  console.log("Seeding database...");
  
  // Create default categories
  const cat1 = await prisma.category.upsert({
    where: { slug: "organic-apparel" },
    update: {},
    create: {
      name: "Organic Apparel",
      slug: "organic-apparel",
      description: "Ethical spun organic fiber garments.",
    },
  });

  const cat2 = await prisma.category.upsert({
    where: { slug: "zero-waste-living" },
    update: {},
    create: {
      name: "Zero-Waste Living",
      slug: "zero-waste-living",
      description: "Zero single-use plastics lifestyle essentials.",
    },
  });

  const cat3 = await prisma.category.upsert({
    where: { slug: "renewable-energy" },
    update: {},
    create: {
      name: "Renewable Energy",
      slug: "renewable-energy",
      description: "Solar powered portable electronics and devices.",
    },
  });

  const cat4 = await prisma.category.upsert({
    where: { slug: "eco-home-goods" },
    update: {},
    create: {
      name: "Eco Home Goods",
      slug: "eco-home-goods",
      description: "Furniture and tableware repurposed from architectural waste and reclaimed timber.",
    },
  });

  // Hashed passwords for accounts
  const adminPassword = hashPassword("Admin@123");
  const buyerPassword = hashPassword("Buyer@123");
  const sellerPassword = hashPassword("Seller@123");

  // Create default Admin and Buyer users
  await prisma.user.upsert({
    where: { email: "admin@earthcentric.com" },
    update: {
      password: adminPassword,
    },
    create: {
      name: "EarthCentric Admin",
      email: "admin@earthcentric.com",
      password: adminPassword,
      role: "ADMIN",
    },
  });

  await prisma.user.upsert({
    where: { email: "buyer@earthcentric.com" },
    update: {
      password: buyerPassword,
    },
    create: {
      name: "Alex Conscious",
      email: "buyer@earthcentric.com",
      password: buyerPassword,
      role: "BUYER",
    },
  });

  const sellers = [
    {
      email: "seller1@earthcentric.com",
      name: "Seller One",
      company: "Green Earth Manufacturing",
      desc: "Industrial-scale sustainable manufacturing processes with zero waste.",
      logo: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=400",
      score: 95,
      prodName: "Eco Factory Gadget",
      prodDesc: "An eco-friendly gadget produced entirely with renewable energy.",
      catId: cat3.id,
      img: "https://images.unsplash.com/photo-1624996379697-f01d168b1a52?w=400"
    },
    {
      email: "seller2@earthcentric.com",
      name: "Seller Two",
      company: "EcoLife Products",
      desc: "Daily essentials designed to minimize environmental impact.",
      logo: "https://images.unsplash.com/photo-1531834685032-c34bf0d84c77?w=400",
      score: 92,
      prodName: "Bamboo Life Kit",
      prodDesc: "A complete bamboo-based daily kit for a zero-waste lifestyle.",
      catId: cat2.id,
      img: "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?w=400"
    },
    {
      email: "seller3@earthcentric.com",
      name: "Seller Three",
      company: "Sustainable Living Co.",
      desc: "Creating sustainable living solutions for modern homes.",
      logo: "https://images.unsplash.com/photo-1550989460-0adf9ea622e2?w=400",
      score: 88,
      prodName: "Recycled Coaster Set",
      prodDesc: "Coasters made from 100% recycled industrial materials.",
      catId: cat4.id,
      img: "https://images.unsplash.com/photo-1533038590840-1cde6b66b706?w=400"
    },
    {
      email: "seller4@earthcentric.com",
      name: "Seller Four",
      company: "Pure Planet Goods",
      desc: "Unadulterated organic apparel and accessories.",
      logo: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400",
      score: 90,
      prodName: "Organic Hemp Bag",
      prodDesc: "Durable and sustainable bag made from 100% natural hemp fibers.",
      catId: cat1.id,
      img: "https://images.unsplash.com/photo-1544816155-12df9643f363?w=400"
    },
    {
      email: "seller5@earthcentric.com",
      name: "Seller Five",
      company: "Green Future Industries",
      desc: "Pioneering the future of eco-friendly building materials.",
      logo: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=400",
      score: 98,
      prodName: "Upcycled Timber Frame",
      prodDesc: "Premium home decor made from upcycled timber.",
      catId: cat4.id,
      img: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=400"
    }
  ];

  for (const s of sellers) {
    const user = await prisma.user.upsert({
      where: { email: s.email },
      update: {
        password: sellerPassword,
      },
      create: {
        name: s.name,
        email: s.email,
        password: sellerPassword,
        role: "SELLER",
      },
    });

    const sellerProfile = await prisma.seller.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        companyName: s.company,
        businessType: "Manufacturer",
        description: s.desc,
        logoUrl: s.logo,
        verificationStatus: "APPROVED",
        badges: ["Verified Business"],
      },
    });

    const productSlug = s.prodName.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    await prisma.product.upsert({
      where: { slug: productSlug },
      update: {},
      create: {
        name: s.prodName,
        slug: productSlug,
        description: s.prodDesc,
        price: 999,
        stock: 50,
        categoryId: s.catId,
        sellerId: sellerProfile.id,
        isApproved: true,
        images: {
          create: [
            {
              url: s.img,
              sortOrder: 0,
            }
          ],
        },
      },
    });
  }

  console.log("Database seeded successfully with 5 demo sellers!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
