import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database reset...');

  // 1. Delete all existing data in reverse order of dependencies
  console.log('Deleting existing records...');
  await prisma.review.deleteMany();
  await prisma.payoutRequest.deleteMany();
  await prisma.enquiry.deleteMany();
  await prisma.complaint.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderTimeline.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.wishlistItem.deleteMany();
  await prisma.wishlist.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.productCertification.deleteMany();
  await prisma.product.deleteMany();
  await prisma.sellerDocument.deleteMany();
  await prisma.seller.deleteMany();
  await prisma.address.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
  await prisma.category.deleteMany();
  await prisma.certification.deleteMany();
  
  console.log('Database wiped clean.');

  // 2. Create default categories
  console.log('Seeding base categories...');
  const cat1 = await prisma.category.create({
    data: {
      name: 'Organic Food',
      slug: 'organic-food',
      description: 'Certified organic food products',
    },
  });

  const cat2 = await prisma.category.create({
    data: {
      name: 'Eco-Friendly Home',
      slug: 'eco-friendly-home',
      description: 'Sustainable products for your home',
    },
  });

  // 3. Create Superadmin User
  console.log('Creating Superadmin account...');
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.create({
    data: {
      name: 'Super Admin',
      email: 'admin@earthcentric.com',
      password: adminPassword,
      role: 'ADMIN',
      emailVerified: new Date(),
    },
  });

  // 4. Create Seller User & Seller Profile
  console.log('Creating Test Seller account...');
  const sellerPassword = await bcrypt.hash('seller123', 10);
  const sellerUser = await prisma.user.create({
    data: {
      name: 'Organic Farms Co.',
      email: 'seller@earthcentric.com',
      password: sellerPassword,
      role: 'SELLER',
      emailVerified: new Date(),
    },
  });

  const sellerProfile = await prisma.seller.create({
    data: {
      userId: sellerUser.id,
      companyName: 'Organic Farms Co.',
      businessType: 'Manufacturer',
      description: 'We manufacture the best organic products directly from farms.',
      verificationStatus: 'APPROVED',
      verifiedAt: new Date(),
      phone: '9876543210',
      ownerName: 'Ramesh Singh',
      factoryAddress: '123 Farm Road, Punjab, India',
      bankAccountNo: '1234567890',
      bankName: 'HDFC',
      bankIfsc: 'HDFC0001234',
    }
  });

  // 5. Create Buyer User
  console.log('Creating Test Buyer account...');
  const buyerPassword = await bcrypt.hash('buyer123', 10);
  const buyerUser = await prisma.user.create({
    data: {
      name: 'Test Buyer',
      email: 'buyer@earthcentric.com',
      password: buyerPassword,
      role: 'BUYER',
      emailVerified: new Date(),
    },
  });

  // 6. Create a test product
  console.log('Creating a test product...');
  await prisma.product.create({
    data: {
      sellerId: sellerProfile.id,
      categoryId: cat1.id,
      name: 'Organic Turmeric Powder (Bulk)',
      slug: 'organic-turmeric-powder-bulk',
      description: 'High quality organic turmeric powder straight from our farms in Punjab.',
      shortDescription: '100% Pure Organic Turmeric',
      price: 500, // retail price
      wholesalePrice: 350,
      moq: 10,
      unit: 'kg',
      stock: 1000,
      status: 'APPROVED',
      isApproved: true,
      bulkPriceSlabs: [
        { min: 10, price: 350 },
        { min: 50, price: 300 },
        { min: 100, price: 250 },
      ],
      materialUsed: 'Turmeric Roots',
      deliveryTime: '5-7 Days',
    }
  });

  console.log('Seeding completed successfully!');
  console.log('====================================');
  console.log('Credentials:');
  console.log('Admin:  admin@earthcentric.com / admin123');
  console.log('Seller: seller@earthcentric.com / seller123');
  console.log('Buyer:  buyer@earthcentric.com / buyer123');
  console.log('====================================');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
