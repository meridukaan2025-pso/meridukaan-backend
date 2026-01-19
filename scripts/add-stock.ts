import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function addStock() {
  const productId = process.argv[2];
  const storeId = process.argv[3];
  const qty = parseInt(process.argv[4]) || 100;
  
  if (!productId || !storeId) {
    console.error('Usage: ts-node scripts/add-stock.ts <productId> <storeId> [qty]');
    process.exit(1);
  }
  
  try {
    // Check if inventory exists
    const inventory = await prisma.inventory.findUnique({
      where: {
        storeId_productId: {
          storeId,
          productId,
        },
      },
    });
    
    if (!inventory) {
      // Create inventory if doesn't exist
      await prisma.inventory.create({
        data: {
          storeId,
          productId,
          qtyOnHand: qty,
        },
      });
      console.log(`✅ Created inventory with ${qty} units`);
    } else {
      // Update existing inventory
      await prisma.inventory.update({
        where: {
          storeId_productId: {
            storeId,
            productId,
          },
        },
        data: {
          qtyOnHand: qty,
        },
      });
      console.log(`✅ Updated inventory to ${qty} units`);
    }
    
    // Verify
    const updated = await prisma.inventory.findUnique({
      where: {
        storeId_productId: {
          storeId,
          productId,
        },
      },
    });
    console.log(`📦 Current stock: ${updated?.qtyOnHand}`);
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addStock();
