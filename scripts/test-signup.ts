/**
 * Test signup endpoint with different scenarios
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function testSignup() {
  console.log('🧪 Testing Signup Endpoint\n');

  // Get available stores
  const stores = await prisma.store.findMany();
  console.log('📦 Available Stores:');
  stores.forEach(s => console.log(`   - ${s.name}: ${s.id}`));
  console.log('');

  const validStoreId = stores[0]?.id;
  const invalidStoreId = '19be6951-367a-4b73-b7b7-584a0931f816';

  // Test 1: INVENTORY role with valid storeId (should work)
  console.log('Test 1: INVENTORY role with valid storeId');
  try {
    const res1 = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `test-inventory-${Date.now()}@meridukaan.com`,
        password: 'password123',
        role: 'INVENTORY',
        storeId: validStoreId,
      }),
    });
    const data1 = await res1.json();
    if (res1.ok) {
      console.log('✅ SUCCESS:', data1.user.email, 'created');
    } else {
      console.log('❌ FAILED:', data1.message || data1.error);
    }
  } catch (e: any) {
    console.log('❌ ERROR:', e.message);
  }
  console.log('');

  // Test 2: INVENTORY role with invalid storeId (should show helpful error)
  console.log('Test 2: INVENTORY role with invalid storeId');
  try {
    const res2 = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `test-inventory-invalid-${Date.now()}@meridukaan.com`,
        password: 'password123',
        role: 'INVENTORY',
        storeId: invalidStoreId,
      }),
    });
    const data2 = await res2.json();
    if (res2.ok) {
      console.log('✅ SUCCESS:', data2.user.email, 'created');
    } else {
      console.log('❌ EXPECTED ERROR:', data2.message || data2.error);
      console.log('   Error message includes available stores:', data2.message?.includes('Available stores') ? '✅' : '❌');
    }
  } catch (e: any) {
    console.log('❌ ERROR:', e.message);
  }
  console.log('');

  // Test 3: SALES role without storeId (should fail)
  console.log('Test 3: SALES role without storeId');
  try {
    const res3 = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `test-sales-no-store-${Date.now()}@meridukaan.com`,
        password: 'password123',
        role: 'SALES',
      }),
    });
    const data3 = await res3.json();
    if (res3.ok) {
      console.log('❌ UNEXPECTED SUCCESS:', data3.user.email);
    } else {
      console.log('✅ EXPECTED ERROR:', data3.message || data3.error);
    }
  } catch (e: any) {
    console.log('❌ ERROR:', e.message);
  }
  console.log('');

  // Test 4: SALES role with valid storeId (should work)
  console.log('Test 4: SALES role with valid storeId');
  try {
    const res4 = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `test-sales-${Date.now()}@meridukaan.com`,
        password: 'password123',
        role: 'SALES',
        storeId: validStoreId,
      }),
    });
    const data4 = await res4.json();
    if (res4.ok) {
      console.log('✅ SUCCESS:', data4.user.email, 'created with storeId:', data4.user.storeId);
    } else {
      console.log('❌ FAILED:', data4.message || data4.error);
    }
  } catch (e: any) {
    console.log('❌ ERROR:', e.message);
  }
  console.log('');

  // Test 5: INVENTORY role without storeId (should work - optional)
  console.log('Test 5: INVENTORY role without storeId (optional)');
  try {
    const res5 = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `test-inventory-no-store-${Date.now()}@meridukaan.com`,
        password: 'password123',
        role: 'INVENTORY',
      }),
    });
    const data5 = await res5.json();
    if (res5.ok) {
      console.log('✅ SUCCESS:', data5.user.email, 'created without storeId');
    } else {
      console.log('❌ FAILED:', data5.message || data5.error);
    }
  } catch (e: any) {
    console.log('❌ ERROR:', e.message);
  }

  await prisma.$disconnect();
}

testSignup().catch(console.error);
