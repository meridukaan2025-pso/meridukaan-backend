/**
 * Refine DB: keep only genuine data.
 * - 1 ADMIN, 2–3 users with stores (SALES), 2 stores
 * - 5 barcode products only
 * - Wipe all invoices; create new ones using those products only.
 *
 * Run: npx ts-node scripts/refine-db.ts
 * Or:  npm run scripts:refine-db
 */
import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const KEEP_SKUS = ['5449000009746', '004900000771', '6009510807981', '8901030865117', '8901030865124'];
const KEEP_EMAILS = ['admin@meridukaan.com', 'sales1@meridukaan.com', 'sales2@meridukaan.com'];
const PASSWORD = 'password123';

async function main() {
  console.log('🧹 Refining database...\n');

  // 1) Products to keep
  const products = await prisma.product.findMany({ where: { sku: { in: KEEP_SKUS } } });
  if (products.length === 0) {
    console.error('❌ No barcode products found. Run scripts:add-barcode-products first.');
    process.exit(1);
  }
  console.log('📌 Keeping products:', products.map((p) => p.sku).join(', '));

  // 2) Stores: keep 2 or create
  let stores = await prisma.store.findMany({ orderBy: { createdAt: 'asc' }, take: 2 });
  if (stores.length < 2) {
    if (stores.length === 0) {
      stores = [
        await prisma.store.create({ data: { name: 'Store Karachi Central', region: 'Sindh', city: 'Karachi' } }),
        await prisma.store.create({ data: { name: 'Store Lahore Main', region: 'Punjab', city: 'Lahore' } }),
      ];
      console.log('✅ Created 2 stores');
    } else {
      const [s] = stores;
      const other = await prisma.store.create({
        data: { name: 'Store Lahore Main', region: 'Punjab', city: 'Lahore' },
      });
      stores = [s, other];
      console.log('✅ Created 1 additional store');
    }
  } else {
    stores = stores.slice(0, 2);
  }
  const storeIds = stores.map((s) => s.id);

  // 3) Users: ensure admin, sales1, sales2 exist and have correct storeId
  const hash = await bcrypt.hash(PASSWORD, 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@meridukaan.com' },
    create: { email: 'admin@meridukaan.com', passwordHash: hash, role: UserRole.ADMIN },
    update: { storeId: null, role: UserRole.ADMIN },
  });
  const sales1 = await prisma.user.upsert({
    where: { email: 'sales1@meridukaan.com' },
    create: { email: 'sales1@meridukaan.com', passwordHash: hash, role: UserRole.SALES, storeId: stores[0].id },
    update: { storeId: stores[0].id, role: UserRole.SALES },
  });
  const sales2 = await prisma.user.upsert({
    where: { email: 'sales2@meridukaan.com' },
    create: { email: 'sales2@meridukaan.com', passwordHash: hash, role: UserRole.SALES, storeId: stores[1].id },
    update: { storeId: stores[1].id, role: UserRole.SALES },
  });
  console.log('✅ Users: admin, sales1 (SALES), sales2 (SALES)');

  // 4) Wipe invoices and related
  const di = await prisma.invoiceItem.deleteMany();
  const dinv = await prisma.invoice.deleteMany();
  const dmov = await prisma.inventoryMovement.deleteMany();
  console.log(`🗑️  Deleted: ${di.count} invoice items, ${dinv.count} invoices, ${dmov.count} movements`);

  // 5) Wipe inventory (we will recreate for kept products × stores)
  const dinv2 = await prisma.inventory.deleteMany();
  console.log(`🗑️  Deleted ${dinv2.count} inventory rows`);

  // 6) Delete products not in our list
  const prodIds = new Set(products.map((p) => p.id));
  const allProd = await prisma.product.findMany({ select: { id: true } });
  let dp = 0;
  for (const p of allProd) {
    if (!prodIds.has(p.id)) {
      await prisma.product.delete({ where: { id: p.id } });
      dp++;
    }
  }
  console.log(`🗑️  Deleted ${dp} products`);

  // 7) Delete users not in keep list
  const du = await prisma.user.deleteMany({ where: { email: { notIn: KEEP_EMAILS } } });
  console.log(`🗑️  Deleted ${du.count} users`);

  // 8) Delete stores not in our 2
  const ds = await prisma.store.deleteMany({ where: { id: { notIn: storeIds } } });
  console.log(`🗑️  Deleted ${ds.count} stores`);

  // 9) Inventory: product × store, qty 100
  for (const s of stores) {
    for (const p of products) {
      await prisma.inventory.upsert({
        where: { storeId_productId: { storeId: s.id, productId: p.id } },
        create: { storeId: s.id, productId: p.id, qtyOnHand: 100 },
        update: { qtyOnHand: 100 },
      });
    }
  }
  console.log(`✅ Inventory: ${stores.length} stores × ${products.length} products = 100 each`);

  // 10) Create 5–6 invoices using only kept products
  const salesByStore = new Map<string, string>([
    [stores[0].id, sales1.id],
    [stores[1].id, sales2.id],
  ]);
  const toNum = (n: unknown) => (typeof n === 'object' && n != null && 'toNumber' in (n as any) ? (n as any).toNumber() : Number(n));

  let invCount = 0;
  const demos = [
    { storeIdx: 0, items: [0, 1] as number[], qty: [2, 1] },
    { storeIdx: 1, items: [2, 3] as number[], qty: [1, 2] },
    { storeIdx: 0, items: [0, 2, 4] as number[], qty: [1, 1, 1] },
    { storeIdx: 1, items: [1, 4] as number[], qty: [3, 1] },
    { storeIdx: 0, items: [3] as number[], qty: [2] },
    { storeIdx: 1, items: [0, 1, 2] as number[], qty: [1, 1, 1] },
  ];

  for (const d of demos) {
    const store = stores[d.storeIdx];
    const workerId = salesByStore.get(store.id)!;
    const items: { productId: string; qty: number; unitPrice: number; lineTotal: number }[] = [];
    let totalAmount = 0;
    let totalItems = 0;

    for (let i = 0; i < d.items.length; i++) {
      const p = products[d.items[i]];
      const qty = d.qty[i] ?? 1;
      const up = toNum(p.unitPrice) || 0;
      const line = up * qty;
      items.push({ productId: p.id, qty, unitPrice: up, lineTotal: line });
      totalAmount += line;
      totalItems += qty;
    }

    const inv = await prisma.invoice.create({
      data: {
        storeId: store.id,
        workerId,
        totalAmount,
        totalItems,
        status: 'COMPLETED',
        clientInvoiceRef: `INV-REF-${Date.now().toString(36).toUpperCase()}`,
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

  console.log(`✅ Created ${invCount} invoices (using barcode products only)`);
  console.log('\n✨ Refine done. Users: admin, sales1, sales2. Password: ' + PASSWORD);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
