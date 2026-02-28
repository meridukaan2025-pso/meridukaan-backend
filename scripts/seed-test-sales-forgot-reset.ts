/**
 * Seeds a SALES user for testing the forgot-password (phone + OTP / link) flow.
 * Phone: +923001234567 (dummy test number)
 * Password: Test@123
 *
 * Run: npx ts-node scripts/seed-test-sales-forgot-reset.ts
 */
import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const TEST_PHONE = '+923001234567';
const TEST_EMAIL = 'test.sales.reset@meridukaan.com';
const TEST_PASSWORD = 'Test@123';
const STORE_NAME = 'Test Sales Store';

function normalizePhone(phone: string) {
  const n = phone.trim().replace(/[()\-\s]/g, '');
  if (!/^\+[1-9]\d{7,14}$/.test(n)) throw new Error('Invalid E.164 phone');
  return n;
}

async function main() {
  const phoneNumber = normalizePhone(TEST_PHONE);
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

  let store = await prisma.store.findFirst({
    where: { name: { equals: STORE_NAME, mode: 'insensitive' } },
  });
  if (!store) {
    store = await prisma.store.create({
      data: { name: STORE_NAME, city: 'Karachi', region: 'Sindh' },
    });
    console.log(`✅ Created store: ${store.name}`);
  }

  const existing = await prisma.user.findFirst({
    where: { phoneNumber },
  });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        email: TEST_EMAIL,
        phoneNumber,
        passwordHash,
        role: UserRole.SALES,
        storeId: store.id,
      },
    });
    console.log(`✅ Updated SALES user for phone ${phoneNumber}`);
  } else {
    await prisma.user.create({
      data: {
        email: TEST_EMAIL,
        phoneNumber,
        passwordHash,
        role: UserRole.SALES,
        storeId: store.id,
        firstName: 'Test',
        lastName: 'Sales',
      },
    });
    console.log(`✅ Created SALES user for phone ${phoneNumber}`);
  }

  console.log(`
Test user for forgot-password flow:
  Phone:    ${phoneNumber}
  Email:    ${TEST_EMAIL}
  Password: ${TEST_PASSWORD}
  Role:     SALES

Use this phone on /sales/forgot-password (OTP flow) or run:
  npm run scripts:test-sales-forgot-reset-flow
to test the link-based reset via API.`);
}

main()
  .catch((e) => {
    console.error('❌', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
