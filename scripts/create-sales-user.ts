import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Creating sales@meridukaan.com user...');

  const passwordHash = await bcrypt.hash('password123', 10);

  // Get first store for the sales user
  const store = await prisma.store.findFirst();
  
  if (!store) {
    console.error('❌ No stores found. Please run seed first.');
    process.exit(1);
  }

  try {
    const user = await prisma.user.upsert({
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
      },
    });

    console.log(`✅ User created/updated: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Store: ${store.name}`);
    console.log(`   Password: password123`);
  } catch (error) {
    console.error('❌ Error creating user:', error);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
