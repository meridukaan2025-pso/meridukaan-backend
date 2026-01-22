/**
 * Count invoices in the database (uses DATABASE_URL from env).
 * Run: DATABASE_URL="postgresql://..." npx ts-node scripts/count-invoices.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.invoice.count();
  console.log('Invoices in DB:', count);
  const stores = await prisma.store.count();
  const products = await prisma.product.count();
  console.log('Stores:', stores, '| Products:', products);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
