/**
 * Verify all products have storeId assigned
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Verifying store assignment...\n');

  const totalProducts = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count FROM products
  `;
  
  const productsWithStore = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count FROM products WHERE store_id IS NOT NULL
  `;

  const total = Number(totalProducts[0].count);
  const withStore = Number(productsWithStore[0].count);

  console.log(`📊 Total products: ${total}`);
  console.log(`📊 Products with store_id: ${withStore}`);

  if (total === withStore) {
    console.log('\n✅ All products have store_id assigned!');
    
    // Show distribution (cast store_id to match stores.id type)
    const distribution = await prisma.$queryRaw<Array<{ store_name: string; count: bigint }>>`
      SELECT s.name as store_name, COUNT(p.id) as count
      FROM stores s
      LEFT JOIN products p ON p.store_id::text = s.id::text
      GROUP BY s.id, s.name
      ORDER BY count DESC
    `;
    
    console.log('\n📦 Distribution by store:');
    distribution.forEach((row) => {
      console.log(`   ${row.store_name}: ${row.count} products`);
    });
  } else {
    console.log(`\n⚠️  ${total - withStore} products missing store_id`);
    console.log('   Run: npx ts-node scripts/apply-store-id-migration.ts');
  }
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
