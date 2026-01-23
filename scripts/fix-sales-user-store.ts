import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Fixing sales users - assigning stores...\n');

  // Get all stores
  const stores = await prisma.store.findMany();
  
  if (stores.length === 0) {
    console.error('❌ No stores found. Please run seed first.');
    process.exit(1);
  }

  console.log(`📦 Found ${stores.length} stores`);

  // Get all SALES users without storeId
  const salesUsers = await prisma.user.findMany({
    where: {
      role: 'SALES',
      storeId: null,
    },
  });

  if (salesUsers.length === 0) {
    console.log('✅ All SALES users already have stores assigned.');
    process.exit(0);
  }

  console.log(`👥 Found ${salesUsers.length} SALES users without storeId\n`);

  // Assign stores to users
  for (let i = 0; i < salesUsers.length; i++) {
    const user = salesUsers[i];
    const store = stores[i % stores.length]; // Round-robin assignment
    
    await prisma.user.update({
      where: { id: user.id },
      data: { storeId: store.id },
    });

    console.log(`✅ Assigned ${user.email} to store: ${store.name}`);
  }

  console.log(`\n✨ Done! Fixed ${salesUsers.length} users.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
