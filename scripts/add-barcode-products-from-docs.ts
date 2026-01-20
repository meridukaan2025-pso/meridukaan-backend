/**
 * Add barcode products from docs/images (FRONTEND_PRODUCT_CHECK_FLOW, barcode*.png, image (1).png).
 * SKUs: 5449000009746, 004900000771, 6009510807981
 * Idempotent: skips if product with SKU already exists.
 *
 * Run: npx ts-node scripts/add-barcode-products-from-docs.ts
 * Or:  npm run scripts:add-barcode-products
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BARCODE_PRODUCTS = [
  { sku: '5449000009746', name: 'Product 5449000009746' }, // docs/images/barcode-5449000009746.png
  { sku: '004900000771', name: 'Product 004900000771' },   // docs/images/barcode.png
  { sku: '6009510807981', name: 'Product 6009510807981' }, // docs/images/image (1).png
] as const;

async function main() {
  console.log('📦 Adding barcode products from docs/images...');

  let category = await prisma.category.findFirst();
  if (!category) {
    category = await prisma.category.create({ data: { name: 'Barcode Products' } });
    console.log('✅ Created category: Barcode Products');
  }

  let manufacturer = await prisma.manufacturer.findFirst({ where: { name: 'Unknown' } });
  if (!manufacturer) {
    manufacturer = await prisma.manufacturer.create({ data: { name: 'Unknown' } });
    console.log('✅ Created manufacturer: Unknown');
  }

  let brand = await prisma.brand.findFirst({
    where: { name: 'Barcode', manufacturerId: manufacturer.id },
  });
  if (!brand) {
    brand = await prisma.brand.create({
      data: { name: 'Barcode', manufacturerId: manufacturer.id },
    });
    console.log('✅ Created brand: Barcode');
  }

  let created = 0;
  let skipped = 0;

  for (const { sku, name } of BARCODE_PRODUCTS) {
    const exists = await prisma.product.findUnique({ where: { sku } });
    if (exists) {
      console.log(`⏭️  Skipped (exists): ${sku}`);
      skipped++;
      continue;
    }
    await prisma.product.create({
      data: {
        sku,
        name,
        categoryId: category.id,
        brandId: brand.id,
        manufacturerId: manufacturer.id,
        unitPrice: 1, // default; edit in Admin or POS
        unitSizeMl: null,
      },
    });
    console.log(`✅ Created: ${sku} (${name})`);
    created++;
  }

  console.log(`\n✨ Done. Created: ${created}, Skipped: ${skipped}`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
