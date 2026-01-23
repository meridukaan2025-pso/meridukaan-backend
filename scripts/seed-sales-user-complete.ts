/**
 * Complete Seed Script: Sales User + Store + Products + Sales + Purchases
 * 
 * Creates:
 * 1. Sales user (sales@meridukaan.com) with store assignment
 * 2. Products in inventory for that store
 * 3. Sales invoices (completed transactions)
 * 4. Purchase orders (inventory movements IN type)
 * 
 * Run: npx ts-node scripts/seed-sales-user-complete.ts
 */
import { PrismaClient, UserRole, InventoryMovementType, InvoiceStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const toNum = (n: unknown): number =>
  typeof n === 'object' && n != null && 'toNumber' in (n as object)
    ? (n as { toNumber: () => number }).toNumber()
    : Number(n) || 0;

async function main() {
  console.log('🌱 Starting complete sales user seed...\n');

  // Step 1: Get or create store
  let store = await prisma.store.findFirst({
    where: { name: { contains: 'Karachi' } },
  });

  if (!store) {
    store = await prisma.store.create({
      data: {
        name: 'Store Karachi Central',
        region: 'Sindh',
        city: 'Karachi',
      },
    });
    console.log(`✅ Created store: ${store.name}`);
  } else {
    console.log(`✅ Using existing store: ${store.name}`);
  }

  // Step 2: Create sales user
  const passwordHash = await bcrypt.hash('password123', 10);
  
  const salesUser = await prisma.user.upsert({
    where: { email: 'sales@meridukaan.com' },
    update: {
      passwordHash,
      role: UserRole.SALES,
      storeId: store.id,
    },
    create: {
      email: 'sales@meridukaan.com',
      passwordHash,
      role: UserRole.SALES,
      storeId: store.id,
      firstName: 'Sales',
      lastName: 'User',
    },
  });

  console.log(`✅ Created/updated sales user: ${salesUser.email}`);
  console.log(`   Store: ${store.name}\n`);

  // Step 3: Get products (or create some if none exist)
  let products = await prisma.product.findMany({
    take: 10,
  });

  if (products.length === 0) {
    console.log('⚠️  No products found. Creating sample products...');
    
    // Get or create category
    let category = await prisma.category.findFirst({ where: { name: 'Beverages' } });
    if (!category) {
      category = await prisma.category.create({ data: { name: 'Beverages' } });
    }

    // Get or create manufacturer
    let manufacturer = await prisma.manufacturer.findFirst({ where: { name: 'Coca-Cola' } });
    if (!manufacturer) {
      manufacturer = await prisma.manufacturer.create({ data: { name: 'Coca-Cola' } });
    }

    // Get or create brand
    let brand = await prisma.brand.findFirst({ 
      where: { name: 'Coca-Cola', manufacturerId: manufacturer.id } 
    });
    if (!brand) {
      brand = await prisma.brand.create({ 
        data: { name: 'Coca-Cola', manufacturerId: manufacturer.id } 
      });
    }

    // Create products
    products = await Promise.all([
      prisma.product.create({
        data: {
          sku: 'COKE-500ML',
          name: 'Coca-Cola 500ml',
          categoryId: category.id,
          brandId: brand.id,
          manufacturerId: manufacturer.id,
          unitPrice: 80.0,
          unitSizeMl: 500,
        },
      }),
      prisma.product.create({
        data: {
          sku: 'COKE-1.5L',
          name: 'Coca-Cola 1.5L',
          categoryId: category.id,
          brandId: brand.id,
          manufacturerId: manufacturer.id,
          unitPrice: 150.0,
          unitSizeMl: 1500,
        },
      }),
      prisma.product.create({
        data: {
          sku: 'SPRITE-500ML',
          name: 'Sprite 500ml',
          categoryId: category.id,
          brandId: brand.id,
          manufacturerId: manufacturer.id,
          unitPrice: 75.0,
          unitSizeMl: 500,
        },
      }),
    ]);
    console.log(`✅ Created ${products.length} products\n`);
  } else {
    console.log(`✅ Using ${products.length} existing products\n`);
  }

  // Step 4: Ensure inventory exists with good stock
  console.log('📦 Setting up inventory...');
  for (const product of products) {
    await prisma.inventory.upsert({
      where: {
        storeId_productId: {
          storeId: store.id,
          productId: product.id,
        },
      },
      create: {
        storeId: store.id,
        productId: product.id,
        qtyOnHand: 100, // Good stock
      },
      update: {
        qtyOnHand: 100, // Ensure good stock
      },
    });
  }
  console.log(`✅ Inventory set up for ${products.length} products\n`);

  // Step 5: Create Purchase Orders (Inventory Movements IN)
  console.log('🛒 Creating purchase orders...');
  const purchaseOrders = [];
  
  for (let i = 0; i < 5; i++) {
    const product = products[i % products.length];
    const qty = 20 + (i * 5); // 20, 25, 30, 35, 40
    const unitPrice = toNum(product.unitPrice);
    const totalAmount = qty * unitPrice;

    // Create inventory movement (IN = purchase)
    const movement = await prisma.inventoryMovement.create({
      data: {
        storeId: store.id,
        productId: product.id,
        type: InventoryMovementType.IN,
        qty: qty,
        refType: 'PURCHASE',
        refId: `PURCHASE-${Date.now()}-${i}`,
        createdAt: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)), // Different dates
      },
    });

    // Update inventory
    await prisma.inventory.update({
      where: {
        storeId_productId: {
          storeId: store.id,
          productId: product.id,
        },
      },
      data: {
        qtyOnHand: { increment: qty },
      },
    });

    purchaseOrders.push({
      id: movement.id,
      productName: product.name,
      qty,
      unitPrice,
      totalAmount,
      date: movement.createdAt,
    });
  }
  console.log(`✅ Created ${purchaseOrders.length} purchase orders\n`);

  // Step 6: Create Sales Invoices
  console.log('💰 Creating sales invoices...');
  const invoices = [];
  
  for (let i = 0; i < 8; i++) {
    const numItems = 1 + (i % 3); // 1-3 items per invoice
    const items: { productId: string; qty: number; unitPrice: number; lineTotal: number }[] = [];
    let totalAmount = 0;
    let totalItems = 0;

    for (let j = 0; j < numItems; j++) {
      const product = products[(i + j) % products.length];
      const qty = 1 + (j % 2); // 1 or 2
      const unitPrice = toNum(product.unitPrice);
      const lineTotal = unitPrice * qty;
      
      items.push({
        productId: product.id,
        qty,
        unitPrice,
        lineTotal,
      });
      
      totalAmount += lineTotal;
      totalItems += qty;
    }

    const invoice = await prisma.invoice.create({
      data: {
        storeId: store.id,
        workerId: salesUser.id,
        totalAmount,
        totalItems,
        status: InvoiceStatus.COMPLETED,
        clientInvoiceRef: `INV-${Date.now().toString(36).toUpperCase()}-${i}`,
        createdAt: new Date(Date.now() - (i * 12 * 60 * 60 * 1000)), // Different times
        items: {
          create: items,
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    // Update inventory (decrease stock)
    for (const item of items) {
      await prisma.inventory.update({
        where: {
          storeId_productId: {
            storeId: store.id,
            productId: item.productId,
          },
        },
        data: {
          qtyOnHand: { decrement: item.qty },
        },
      });

      // Create inventory movement (OUT = sale)
      await prisma.inventoryMovement.create({
        data: {
          storeId: store.id,
          productId: item.productId,
          type: InventoryMovementType.OUT,
          qty: item.qty,
          refType: 'INVOICE',
          refId: invoice.id,
          createdAt: invoice.createdAt,
        },
      });
    }

    invoices.push(invoice);
  }

  console.log(`✅ Created ${invoices.length} sales invoices\n`);

  // Summary
  console.log('✨ Seed completed successfully!\n');
  console.log('📊 Summary:');
  console.log(`   Store: ${store.name}`);
  console.log(`   Sales User: ${salesUser.email} (password: password123)`);
  console.log(`   Products: ${products.length}`);
  console.log(`   Purchase Orders: ${purchaseOrders.length}`);
  console.log(`   Sales Invoices: ${invoices.length}`);
  console.log(`\n💡 Login at /sales-login with:`);
  console.log(`   Email: sales@meridukaan.com`);
  console.log(`   Password: password123`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
