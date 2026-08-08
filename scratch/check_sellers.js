const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sellers = await prisma.user.findMany({
    where: { role: 'SELLER' },
    select: { email: true, name: true, role: true, seller: { select: { companyName: true, verificationStatus: true } } }
  });
  console.log(JSON.stringify(sellers, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
