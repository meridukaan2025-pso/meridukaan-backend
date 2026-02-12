import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

function normalizePhoneNumber(phoneNumber: string) {
  const normalized = phoneNumber.trim().replace(/[()\-\s]/g, '');
  const isE164 = /^\+[1-9]\d{7,14}$/.test(normalized);

  if (!isE164) {
    throw new Error('Phone number must be in E.164 format (e.g. +923001234567)');
  }

  return normalized;
}

async function main() {
  const phoneNumber = normalizePhoneNumber(process.env.TEST_SALES_PHONE || '+923274124451');
  const email = (process.env.TEST_SALES_EMAIL || 'sales.phone.test@meridukaan.com').trim().toLowerCase();
  const password = process.env.TEST_SALES_PASSWORD || 'password123';
  const storeName = (process.env.TEST_SALES_STORE_NAME || 'Sales Test Store').trim();
  const storeCity = (process.env.TEST_SALES_STORE_CITY || 'Karachi').trim();
  const storeRegion = (process.env.TEST_SALES_STORE_REGION || 'Sindh').trim();

  console.log(`🌱 Ensuring SALES user exists for phone ${phoneNumber}...`);

  const passwordHash = await bcrypt.hash(password, 10);

  let store = await prisma.store.findFirst({
    where: { name: { equals: storeName, mode: 'insensitive' } },
  });

  if (!store) {
    store = await prisma.store.create({
      data: {
        name: storeName,
        city: storeCity,
        region: storeRegion,
      },
    });
    console.log(`✅ Created store: ${store.name} (${store.id})`);
  } else {
    console.log(`✅ Using existing store: ${store.name} (${store.id})`);
  }

  const existingByPhone = await prisma.user.findFirst({
    where: { phoneNumber },
  });

  if (existingByPhone) {
    const updatedUser = await prisma.user.update({
      where: { id: existingByPhone.id },
      data: {
        email,
        phoneNumber,
        passwordHash,
        role: UserRole.SALES,
        storeId: store.id,
      },
    });

    console.log(`✅ Updated existing user by phone: ${updatedUser.id}`);
    console.log(`   Email: ${updatedUser.email}`);
    console.log(`   Phone: ${updatedUser.phoneNumber}`);
    console.log(`   Role: ${updatedUser.role}`);
    console.log(`   Store: ${store.name}`);
    console.log(`   Password: ${password}`);
    return;
  }

  const existingByEmail = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
  });

  if (existingByEmail) {
    const updatedUser = await prisma.user.update({
      where: { id: existingByEmail.id },
      data: {
        phoneNumber,
        passwordHash,
        role: UserRole.SALES,
        storeId: store.id,
      },
    });

    console.log(`✅ Updated existing user by email: ${updatedUser.id}`);
    console.log(`   Email: ${updatedUser.email}`);
    console.log(`   Phone: ${updatedUser.phoneNumber}`);
    console.log(`   Role: ${updatedUser.role}`);
    console.log(`   Store: ${store.name}`);
    console.log(`   Password: ${password}`);
    return;
  }

  const createdUser = await prisma.user.create({
    data: {
      email,
      phoneNumber,
      passwordHash,
      role: UserRole.SALES,
      storeId: store.id,
      firstName: 'Demo',
      lastName: 'Sales',
    },
  });

  console.log(`✅ Created SALES user: ${createdUser.id}`);
  console.log(`   Email: ${createdUser.email}`);
  console.log(`   Phone: ${createdUser.phoneNumber}`);
  console.log(`   Role: ${createdUser.role}`);
  console.log(`   Store: ${store.name}`);
  console.log(`   Password: ${password}`);
}

main()
  .catch((error) => {
    console.error('❌ Failed to ensure sales phone user:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
