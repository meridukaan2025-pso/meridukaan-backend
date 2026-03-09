/**
 * Update existing users with firstName/lastName for display on Users page.
 * Run: npx ts-node scripts/seed-user-names.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const UPDATES: { email: string; firstName: string; lastName: string }[] = [
  { email: 'admin@meridukaan.com', firstName: 'Admin', lastName: 'User' },
  { email: 'sales1@meridukaan.com', firstName: 'Sales', lastName: 'One' },
  { email: 'sales2@meridukaan.com', firstName: 'Sales', lastName: 'Two' },
  { email: 'inventory@meridukaan.com', firstName: 'Inventory', lastName: 'Manager' },
  { email: 'purchase@meridukaan.com', firstName: 'Purchase', lastName: 'Officer' },
];

async function main() {
  console.log('👤 Updating user names...\n');
  for (const u of UPDATES) {
    const updated = await prisma.user.updateMany({
      where: { email: u.email },
      data: { firstName: u.firstName, lastName: u.lastName },
    });
    if (updated.count > 0) console.log(`   ✅ ${u.email} → ${u.firstName} ${u.lastName}`);
  }
  console.log('\n✅ User names updated.');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
