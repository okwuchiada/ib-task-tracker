import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const environments = ['Prod', 'Staging', 'Dev'];
  for (const [i, name] of environments.entries()) {
    await prisma.environment.upsert({
      where: { name },
      update: {},
      create: { name, sortOrder: i },
    });
  }
  await prisma.project.upsert({
    where: { code: 'IPO' },
    update: {},
    create: { code: 'IPO', name: 'Invest app (IPO)' },
  });
  console.log('Seeded environments (Prod, Staging, Dev) and project IPO');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
