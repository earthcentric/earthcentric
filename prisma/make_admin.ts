import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function main() {
  await db.user.upsert({
    where: { email: 'rkearthcentric@gmail.com' },
    update: { role: 'ADMIN' },
    create: { email: 'rkearthcentric@gmail.com', name: 'RK Admin', role: 'ADMIN' },
  });
  console.log('Successfully made rkearthcentric@gmail.com an ADMIN in Neon database!');
}

main().finally(() => db.$disconnect());
