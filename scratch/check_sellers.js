const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sellers = await prisma.seller.findMany({
    include: { documents: true, user: true }
  });
  console.log('Sellers found:', sellers.length);
  for (const s of sellers) {
    console.log({
      id: s.id,
      userId: s.userId,
      companyName: s.companyName,
      status: s.verificationStatus,
      docs: s.documents.map(d => ({ type: d.type, name: d.fileName, url: d.fileUrl }))
    });
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
