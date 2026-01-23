/**
 * Migration Script: Assign existing products to stores
 * 
 * This script assigns all existing products to stores.
 * Strategy: Assign each product to the first store (or distribute evenly).
 * 
 * Run AFTER running the Prisma migration:
 * npx prisma migrate dev --name add_store_id_to_products
 * npx ts-node scripts/migrate-products-to-stores.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Migrating products to stores...\n');

  // Get all stores
  const stores = await prisma.store.findMany({
    orderBy: { createdAt: 'asc' },
  });

  if (stores.length === 0) {
    console.error('❌ No stores found. Please create stores first.');
    process.exit(1);
  }

  console.log(`📦 Found ${stores.length} stores`);

  // Get all products without storeId
  const productsWithoutStore = await prisma.product.findMany({
    where: {
      storeId: null,
    },
  });

  if (productsWithoutStore.length === 0) {
    console.log('✅ All products already have stores assigned.');
    process.exit(0);
  }

  console.log(`📦 Found ${productsWithoutStore.length} products without storeId\n`);

  // Strategy: Distribute products evenly across stores
  // Or assign all to first store (change strategy here)
  const useFirstStoreOnly = false; // Set to true to assign all to first store

  if (useFirstStoreOnly) {
    // Assign all to first store
    const firstStore = stores[0];
    console.log(`📝 Assigning all products to: ${firstStore.name}\n`);

    for (const product of productsWithoutStore) {
      await prisma.product.update({
        where: { id: product.id },
        data: { storeId: firstStore.id },
      });
      console.log(`✅ Assigned ${product.sku} to ${firstStore.name}`);
    }
  } else {
    // Distribute evenly
    console.log(`📝 Distributing products evenly across stores...\n`);

    for (let i = 0; i < productsWithoutStore.length; i++) {
      const product = productsWithoutStore[i];
      const store = stores[i % stores.length]; // Round-robin

      await prisma.product.update({
        where: { id: product.id },
        data: { storeId: store.id },
      });
      console.log(`✅ Assigned ${product.sku} to ${store.name}`);
    }
  }

  console.log(`\n✨ Migration completed!`);
  console.log(`   Total products migrated: ${productsWithoutStore.length}`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
