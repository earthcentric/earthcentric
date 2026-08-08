const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const paymentCount = await prisma.payment.count();
  console.log('Payment count:', paymentCount);
  const orderCount = await prisma.order.count();
  console.log('Order count:', orderCount);
}

main().catch(console.error).finally(() => prisma.$disconnect());
