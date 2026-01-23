import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Check if seed has already been run (idempotent check)
  const existingUser = await prisma.user.findFirst({
    where: { email: 'admin@meridukaan.com' },
  });

  if (existingUser) {
    console.log('✅ Seed data already exists. Skipping seed...');
    console.log('💡 To re-seed, delete existing data first or set FORCE_SEED=true');
    return;
  }

  // Clear existing data (for development or when FORCE_SEED=true)
  if (process.env.FORCE_SEED === 'true') {
    console.log('🔄 Force seed enabled - clearing existing data...');
    await prisma.invoiceItem.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.inventoryMovement.deleteMany();
    await prisma.inventory.deleteMany();
    await prisma.user.deleteMany();
    await prisma.product.deleteMany();
    await prisma.brand.deleteMany();
    await prisma.manufacturer.deleteMany();
    await prisma.category.deleteMany();
    await prisma.store.deleteMany();
  }

  // Create regions and stores (Pakistan)
  const stores = await Promise.all([
    prisma.store.create({
      data: {
        name: 'Store Karachi Central',
        region: 'Sindh',
        city: 'Karachi',
      },
    }),
    prisma.store.create({
      data: {
        name: 'Store Lahore Main',
        region: 'Punjab',
        city: 'Lahore',
      },
    }),
    prisma.store.create({
      data: {
        name: 'Store Islamabad Branch',
        region: 'Islamabad Capital Territory',
        city: 'Islamabad',
      },
    }),
  ]);

  console.log(`✅ Created ${stores.length} stores`);

  // Create manufacturers
  const manufacturers = await Promise.all([
    prisma.manufacturer.create({ data: { name: 'Coca-Cola Company' } }),
    prisma.manufacturer.create({ data: { name: 'PepsiCo' } }),
    prisma.manufacturer.create({ data: { name: 'Parle Agro' } }),
    prisma.manufacturer.create({ data: { name: 'Dabur' } }),
    prisma.manufacturer.create({ data: { name: 'Hindustan Unilever' } }),
  ]);

  console.log(`✅ Created ${manufacturers.length} manufacturers`);

  // Create brands
  const brands = await Promise.all([
    prisma.brand.create({
      data: {
        name: 'Coca-Cola',
        manufacturerId: manufacturers[0].id,
      },
    }),
    prisma.brand.create({
      data: {
        name: 'Sprite',
        manufacturerId: manufacturers[0].id,
      },
    }),
    prisma.brand.create({
      data: {
        name: 'Pepsi',
        manufacturerId: manufacturers[1].id,
      },
    }),
    prisma.brand.create({
      data: {
        name: '7UP',
        manufacturerId: manufacturers[1].id,
      },
    }),
    prisma.brand.create({
      data: {
        name: 'Frooti',
        manufacturerId: manufacturers[2].id,
      },
    }),
    prisma.brand.create({
      data: {
        name: 'Real',
        manufacturerId: manufacturers[3].id,
      },
    }),
    prisma.brand.create({
      data: {
        name: 'Lipton',
        manufacturerId: manufacturers[4].id,
      },
    }),
  ]);

  console.log(`✅ Created ${brands.length} brands`);

  // Create categories
  const categories = await Promise.all([
    prisma.category.create({ data: { name: 'Beverages' } }),
    prisma.category.create({ data: { name: 'Soft Drinks', parentId: null } }),
    prisma.category.create({ data: { name: 'Juices', parentId: null } }),
    prisma.category.create({ data: { name: 'Tea', parentId: null } }),
  ]);

  const softDrinksCategory = categories[1];
  const juicesCategory = categories[2];
  const teaCategory = categories[3];

  console.log(`✅ Created ${categories.length} categories`);

  // Create products (assign to first store)
  const products = await Promise.all([
    prisma.product.create({
      data: {
        sku: 'COKE-330ML',
        name: 'Coca-Cola 330ml',
        storeId: stores[0].id,
        categoryId: softDrinksCategory.id,
        brandId: brands[0].id,
        manufacturerId: manufacturers[0].id,
        unitPrice: 35.0,
        unitSizeMl: 330,
      },
    }),
    prisma.product.create({
      data: {
        sku: 'SPRITE-330ML',
        name: 'Sprite 330ml',
        storeId: stores[0].id,
        categoryId: softDrinksCategory.id,
        brandId: brands[1].id,
        manufacturerId: manufacturers[0].id,
        unitPrice: 35.0,
        unitSizeMl: 330,
      },
    }),
    prisma.product.create({
      data: {
        sku: 'PEPSI-330ML',
        name: 'Pepsi 330ml',
        storeId: stores[0].id,
        categoryId: softDrinksCategory.id,
        brandId: brands[2].id,
        manufacturerId: manufacturers[1].id,
        unitPrice: 35.0,
        unitSizeMl: 330,
      },
    }),
    prisma.product.create({
      data: {
        sku: '7UP-330ML',
        name: '7UP 330ml',
        storeId: stores[0].id,
        categoryId: softDrinksCategory.id,
        brandId: brands[3].id,
        manufacturerId: manufacturers[1].id,
        unitPrice: 35.0,
        unitSizeMl: 330,
      },
    }),
    prisma.product.create({
      data: {
        sku: 'FROOTI-200ML',
        name: 'Frooti 200ml',
        storeId: stores[0].id,
        categoryId: juicesCategory.id,
        brandId: brands[4].id,
        manufacturerId: manufacturers[2].id,
        unitPrice: 20.0,
        unitSizeMl: 200,
      },
    }),
    prisma.product.create({
      data: {
        sku: 'REAL-200ML',
        name: 'Real Juice 200ml',
        storeId: stores[0].id,
        categoryId: juicesCategory.id,
        brandId: brands[5].id,
        manufacturerId: manufacturers[3].id,
        unitPrice: 25.0,
        unitSizeMl: 200,
      },
    }),
    prisma.product.create({
      data: {
        sku: 'LIPTON-250ML',
        name: 'Lipton Ice Tea 250ml',
        storeId: stores[0].id,
        categoryId: teaCategory.id,
        brandId: brands[6].id,
        manufacturerId: manufacturers[4].id,
        unitPrice: 30.0,
        unitSizeMl: 250,
      },
    }),
  ]);

  console.log(`✅ Created ${products.length} products`);

  // Create inventory for each store-product combination
  const inventoryPromises = [];
  for (const store of stores) {
    for (const product of products) {
      inventoryPromises.push(
        prisma.inventory.create({
          data: {
            storeId: store.id,
            productId: product.id,
            qtyOnHand: Math.floor(Math.random() * 100) + 50, // Random stock 50-150
          },
        }),
      );
    }
  }
  await Promise.all(inventoryPromises);
  console.log(`✅ Created inventory for ${stores.length} stores × ${products.length} products`);

  // Create users
  const passwordHash = await bcrypt.hash('password123', 10);

  const users = await Promise.all([
    prisma.user.create({
      data: {
        email: 'admin@meridukaan.com',
        passwordHash,
        role: UserRole.ADMIN,
      },
    }),
    prisma.user.create({
      data: {
        email: 'sales1@meridukaan.com',
        passwordHash,
        role: UserRole.SALES,
        storeId: stores[0].id,
      },
    }),
    prisma.user.create({
      data: {
        email: 'sales2@meridukaan.com',
        passwordHash,
        role: UserRole.SALES,
        storeId: stores[1].id,
      },
    }),
    prisma.user.create({
      data: {
        email: 'inventory@meridukaan.com',
        passwordHash,
        role: UserRole.INVENTORY,
      },
    }),
    prisma.user.create({
      data: {
        email: 'purchase@meridukaan.com',
        passwordHash,
        role: UserRole.PURCHASE,
      },
    }),
  ]);

  console.log(`✅ Created ${users.length} users`);
  console.log('📝 Default password for all users: password123');

  console.log('✨ Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

