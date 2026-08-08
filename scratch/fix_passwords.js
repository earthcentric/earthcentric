const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function main() {
  const sellerPassword = hashPassword('Seller@123');
  const buyerPassword = hashPassword('Buyer@123');
  const adminPassword = hashPassword('Admin@123');

  // Update existing buyer
  await prisma.user.updateMany({
    where: { role: 'BUYER' },
    data: { password: buyerPassword }
  });

  // Update existing sellers
  await prisma.user.updateMany({
    where: { role: 'SELLER' },
    data: { password: sellerPassword }
  });

  // Ensure admin@earthcentric.com has Admin@123
  await prisma.user.updateMany({
    where: { email: 'admin@earthcentric.com' },
    data: { password: adminPassword }
  });

  // Fetch updated users list
  const users = await prisma.user.findMany({
    select: { email: true, name: true, role: true }
  });

  console.log('--- UPDATED DB USERS ---');
  console.log(JSON.stringify(users, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
