/**
 * Keep ONLY barcode-style products. Delete all TEST*, NEW-*, NONEXISTENT-*,
 * seed products (COKE-330ML, PEPSI-330ML, etc.), and other non-barcode.
 *
 * Barcode SKUs to KEEP: 5449000009746, 004900000771, 6009510807981, 8901030865117, 8901030865124
 *
 * Products with invoice_items are SKIPPED (would break invoice history).
 *
 * Run: npx ts-node scripts/keep-only-barcode-products.ts
 * Or:  npm run scripts:keep-only-barcode-products
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const KEEP_SKUS = new Set([
  '5449000009746',
  '004900000771',
  '6009510807981',
  '8901030865117',
  '8901030865124',
]);

async function main() {
  console.log('🧹 Keeping only barcode products, removing test and non-barcode...\n');

  const all = await prisma.product.findMany({
    select: { id: true, sku: true, _count: { select: { invoiceItems: true } } },
  });

  const toDelete = all.filter((p) => !KEEP_SKUS.has(p.sku));
  const toKeep = all.filter((p) => KEEP_SKUS.has(p.sku));

  console.log('📌 Keeping:', toKeep.map((p) => p.sku).join(', ') || '(none found)');
  console.log('🗑️  To delete:', toDelete.length, 'products\n');

  let deleted = 0;
  const skipped: string[] = [];

  for (const p of toDelete) {
    if (p._count.invoiceItems > 0) {
      skipped.push(`${p.sku} (used in ${p._count.invoiceItems} invoice item(s))`);
      continue;
    }
    await prisma.inventoryMovement.deleteMany({ where: { productId: p.id } });
    await prisma.inventory.deleteMany({ where: { productId: p.id } });
    await prisma.product.delete({ where: { id: p.id } });
    console.log('✅ Deleted:', p.sku);
    deleted++;
  }

  if (skipped.length) {
    console.log('\n⏭️  Skipped (used in invoices):');
    skipped.forEach((s) => console.log('   ', s));
  }

  console.log('\n✨ Done. Deleted:', deleted, '| Skipped:', skipped.length);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
