/**
 * Apply store_id migration manually
 * Run: npx ts-node scripts/apply-store-id-migration.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Applying store_id migration...\n');

  try {
    // Check if column already exists
    const result = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'products' AND column_name = 'store_id'
    `;

    if (result.length > 0) {
      console.log('✅ store_id column already exists');
      
      // Check if all products have storeId
      const productsWithoutStore = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count FROM products WHERE store_id IS NULL
      `;
      
      const count = Number(productsWithoutStore[0].count);
      if (count === 0) {
        console.log('✅ All products already have store_id assigned');
        return;
      }
    } else {
      // Step 1: Add store_id column as nullable (TEXT to match stores.id)
      console.log('📝 Step 1: Adding store_id column...');
      await prisma.$executeRaw`ALTER TABLE "products" ADD COLUMN "store_id" TEXT`;
      console.log('✅ Column added');
    }

    // Step 2: Assign all existing products to the first store
    console.log('📝 Step 2: Assigning products to first store...');
    await prisma.$executeRaw`
      UPDATE "products" 
      SET "store_id" = (SELECT id FROM "stores" ORDER BY "created_at" ASC LIMIT 1)
      WHERE "store_id" IS NULL
    `;
    console.log('✅ Products assigned to store');

    // Step 3: Make store_id required (NOT NULL)
    console.log('📝 Step 3: Making store_id NOT NULL...');
    await prisma.$executeRaw`ALTER TABLE "products" ALTER COLUMN "store_id" SET NOT NULL`;
    console.log('✅ Column set to NOT NULL');

    // Step 4: Add foreign key constraint (if not exists)
    console.log('📝 Step 4: Adding foreign key constraint...');
    try {
      await prisma.$executeRaw`
        ALTER TABLE "products" ADD CONSTRAINT "products_store_id_fkey" 
        FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE
      `;
      console.log('✅ Foreign key constraint added');
    } catch (e: any) {
      if (e.message?.includes('already exists')) {
        console.log('⏭️  Foreign key constraint already exists');
      } else {
        throw e;
      }
    }

    // Step 5: Drop old unique constraint on sku (if exists)
    console.log('📝 Step 5: Dropping old SKU unique constraint...');
    try {
      await prisma.$executeRaw`ALTER TABLE "products" DROP CONSTRAINT "products_sku_key"`;
      console.log('✅ Old constraint dropped');
    } catch (e: any) {
      if (e.message?.includes('does not exist')) {
        console.log('⏭️  Old constraint does not exist');
      } else {
        throw e;
      }
    }

    // Step 6: Add new unique constraint on (sku, store_id)
    console.log('📝 Step 6: Adding new unique constraint (sku, store_id)...');
    try {
      await prisma.$executeRaw`
        ALTER TABLE "products" ADD CONSTRAINT "products_sku_store_id_key" UNIQUE ("sku", "store_id")
      `;
      console.log('✅ New unique constraint added');
    } catch (e: any) {
      if (e.message?.includes('already exists')) {
        console.log('⏭️  Unique constraint already exists');
      } else {
        throw e;
      }
    }

    console.log('\n✨ Migration completed successfully!');
    
    // Verify
    const productCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM products
    `;
    const productsWithStore = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM products WHERE store_id IS NOT NULL
    `;
    const total = Number(productCount[0].count);
    const withStore = Number(productsWithStore[0].count);
    
    console.log(`\n📊 Verification:`);
    console.log(`   Total products: ${total}`);
    console.log(`   Products with store_id: ${withStore}`);
    
    if (total === withStore) {
      console.log('✅ All products have store_id assigned');
    } else {
      console.log(`⚠️  ${total - withStore} products missing store_id`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
