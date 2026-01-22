/**
 * Seed Invoices: create sample invoices from existing products, stores, and inventory.
 * - Ensures inventory exists for products at stores (qty 50 if missing)
 * - Creates 6–8 invoices so Dashboard, Analytics, and Invoices page show data.
 *
 * Run: npx ts-node scripts/seed-invoices.ts
 * Or:  npm run scripts:seed-invoices
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const toNum = (n: unknown): number =>
  typeof n === 'object' && n != null && 'toNumber' in (n as object)
    ? (n as { toNumber: () => number }).toNumber()
    : Number(n) || 0;

async function main() {
  console.log('📦 Seeding invoices...\n');

  const stores = await prisma.store.findMany({ orderBy: { createdAt: 'asc' } });
  const products = await prisma.product.findMany({
    select: { id: true, sku: true, unitPrice: true, name: true },
  });
  const worker = await prisma.user.findFirst({
    where: { role: { in: ['SALES', 'ADMIN'] } },
    select: { id: true, email: true },
  });

  if (stores.length === 0) {
    console.error('❌ No stores. Run prisma:seed first.');
    process.exit(1);
  }
  if (products.length === 0) {
    console.error('❌ No products. Run prisma:seed or scripts:add-barcode-products first.');
    process.exit(1);
  }
  if (!worker) {
    console.error('❌ No SALES or ADMIN user. Run prisma:seed first.');
    process.exit(1);
  }

  console.log(`   Stores: ${stores.length}, Products: ${products.length}, Worker: ${worker.email}`);

  // Ensure inventory: each store × first N products has qty >= 50 so we can create invoice items
  const prodsToUse = products.slice(0, Math.min(products.length, 8));
  for (const s of stores) {
    for (const p of prodsToUse) {
      await prisma.inventory.upsert({
        where: { storeId_productId: { storeId: s.id, productId: p.id } },
        create: { storeId: s.id, productId: p.id, qtyOnHand: 50 },
        update: { qtyOnHand: 50 }, // ensure at least 50 for seeding (re-run safe)
      });
    }
  }
  console.log('✅ Inventory ensured for stores × products\n');

  const NUM_INVOICES = 8;
  const demos: { storeIdx: number; productIdxs: number[]; qtys: number[] }[] = [];
  for (let i = 0; i < NUM_INVOICES; i++) {
    const storeIdx = i % stores.length;
    const n = 1 + (i % 3); // 1–3 items per invoice
    const productIdxs: number[] = [];
    const qtys: number[] = [];
    for (let j = 0; j < n; j++) {
      productIdxs.push((i + j) % prodsToUse.length);
      qtys.push(1 + (j % 2)); // 1 or 2
    }
    demos.push({ storeIdx, productIdxs, qtys });
  }

  let invCount = 0;
  for (const d of demos) {
    const store = stores[d.storeIdx];
    const items: { productId: string; qty: number; unitPrice: number; lineTotal: number }[] = [];
    let totalAmount = 0;
    let totalItems = 0;

    for (let i = 0; i < d.productIdxs.length; i++) {
      const p = prodsToUse[d.productIdxs[i]];
      const qty = d.qtys[i] ?? 1;
      const up = toNum(p.unitPrice) || 0;
      const line = up * qty;
      items.push({ productId: p.id, qty, unitPrice: up, lineTotal: line });
      totalAmount += line;
      totalItems += qty;
    }

    const inv = await prisma.invoice.create({
      data: {
        storeId: store.id,
        workerId: worker.id,
        totalAmount,
        totalItems,
        status: 'COMPLETED',
        clientInvoiceRef: `INV-SEED-${Date.now().toString(36).toUpperCase()}-${invCount}`,
        items: { create: items },
      },
    });

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      await prisma.inventory.update({
        where: { storeId_productId: { storeId: store.id, productId: it.productId } },
        data: { qtyOnHand: { decrement: it.qty } },
      });
      await prisma.inventoryMovement.create({
        data: {
          storeId: store.id,
          productId: it.productId,
          type: 'OUT',
          qty: it.qty,
          refType: 'INVOICE',
          refId: inv.id,
        },
      });
    }
    invCount++;
  }

  console.log(`✅ Created ${invCount} invoices.`);
  console.log('   Dashboard, Analytics, and Invoices should now show data.');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
