/**
 * Seed Purchase Orders: create sample purchases (inventory movements IN type).
 * - Creates 6–8 purchase orders so Dashboard, Reports, and Purchases page show data.
 *
 * Run: npx ts-node scripts/seed-purchases.ts
 * Or:  npm run scripts:seed-purchases
 */
import { PrismaClient, InventoryMovementType } from '@prisma/client';

const prisma = new PrismaClient();

const toNum = (n: unknown): number =>
  typeof n === 'object' && n != null && 'toNumber' in (n as object)
    ? (n as { toNumber: () => number }).toNumber()
    : Number(n) || 0;

async function main() {
  console.log('🛒 Seeding purchase orders...\n');

  const stores = await prisma.store.findMany({ orderBy: { createdAt: 'asc' } });
  const products = await prisma.product.findMany({
    select: { id: true, sku: true, unitPrice: true, name: true },
  });

  if (stores.length === 0) {
    console.error('❌ No stores. Run prisma:seed first.');
    process.exit(1);
  }
  if (products.length === 0) {
    console.error('❌ No products. Run prisma:seed first.');
    process.exit(1);
  }

  console.log(`   Stores: ${stores.length}, Products: ${products.length}`);

  const prodsToUse = products.slice(0, Math.min(products.length, 8));
  const NUM_PURCHASES = 8;

  const demos: { storeIdx: number; productIdxs: number[]; qtys: number[] }[] = [];
  for (let i = 0; i < NUM_PURCHASES; i++) {
    const storeIdx = i % stores.length;
    const n = 1 + (i % 3); // 1–3 items per purchase
    const productIdxs: number[] = [];
    const qtys: number[] = [];
    for (let j = 0; j < n; j++) {
      productIdxs.push((i + j) % prodsToUse.length);
      qtys.push(10 + (j % 5)); // 10–14 qty per line
    }
    demos.push({ storeIdx, productIdxs, qtys });
  }

  let poCount = 0;
  for (const d of demos) {
    const store = stores[d.storeIdx];
    const refId = `PURCHASE-${Date.now().toString(36).toUpperCase()}-${poCount}`;

    for (let i = 0; i < d.productIdxs.length; i++) {
      const p = prodsToUse[d.productIdxs[i]];
      const qty = d.qtys[i] ?? 10;
      const up = toNum(p.unitPrice) || 0;

      await prisma.inventoryMovement.create({
        data: {
          storeId: store.id,
          productId: p.id,
          type: InventoryMovementType.IN,
          qty,
          refType: 'PURCHASE',
          refId,
          createdAt: new Date(Date.now() - (poCount * 24 * 60 * 60 * 1000)), // Stagger dates
        },
      });

      await prisma.inventory.upsert({
        where: { storeId_productId: { storeId: store.id, productId: p.id } },
        create: { storeId: store.id, productId: p.id, qtyOnHand: qty },
        update: { qtyOnHand: { increment: qty } },
      });
    }
    poCount++;
  }

  console.log(`✅ Created ${poCount} purchase orders.`);
  console.log('   Dashboard, Reports, and Purchases should now show data.');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
