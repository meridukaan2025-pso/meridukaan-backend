import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = 'password123';

async function main() {
  console.log('🌱 Adding dummy users...');

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  // Fetch existing stores for SALES users
  const stores = await prisma.store.findMany({ take: 3 });
  const [store0, store1, store2] = stores;

  const dummyUsers = [
    { email: 'admin2@meridukaan.com', passwordHash, role: UserRole.ADMIN, storeId: null },
    { email: 'sales3@meridukaan.com', passwordHash, role: UserRole.SALES, storeId: store2?.id ?? null },
    { email: 'cashier1@meridukaan.com', passwordHash, role: UserRole.SALES, storeId: store0?.id ?? null },
    { email: 'cashier2@meridukaan.com', passwordHash, role: UserRole.SALES, storeId: store1?.id ?? null },
    { email: 'inventory2@meridukaan.com', passwordHash, role: UserRole.INVENTORY, storeId: null },
    { email: 'purchase2@meridukaan.com', passwordHash, role: UserRole.PURCHASE, storeId: null },
    { email: 'sara@meridukaan.com', passwordHash, role: UserRole.SALES, storeId: store0?.id ?? null },
    { email: 'ali@meridukaan.com', passwordHash, role: UserRole.SALES, storeId: store1?.id ?? null },
    { email: 'zainab@meridukaan.com', passwordHash, role: UserRole.INVENTORY, storeId: null },
    { email: 'ahmed@meridukaan.com', passwordHash, role: UserRole.PURCHASE, storeId: null },
  ];

  let created = 0;
  let skipped = 0;

  for (const u of dummyUsers) {
    const exists = await prisma.user.findUnique({ where: { email: u.email } });
    if (exists) {
      console.log(`⏭️  Skipped (exists): ${u.email}`);
      skipped++;
      continue;
    }
    await prisma.user.create({
      data: {
        email: u.email,
        passwordHash: u.passwordHash,
        role: u.role,
        storeId: u.storeId,
      },
    });
    console.log(`✅ Created: ${u.email} (${u.role})`);
    created++;
  }

  console.log(`\n✨ Done. Created: ${created}, Skipped: ${skipped}`);
  console.log(`📝 Password for all: ${DEFAULT_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
