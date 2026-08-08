const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const userCount = await prisma.user.count();
  console.log('User count:', userCount);
}

main().catch(console.error).finally(() => prisma.$disconnect());
