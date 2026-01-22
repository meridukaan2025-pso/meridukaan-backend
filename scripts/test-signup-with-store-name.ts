/**
 * Test signup flow with storeName (new flow)
 */
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function testSignupWithStoreName() {
  console.log('🧪 Testing Signup Flow with Store Name\n');

  // Test: Signup with storeName (should create store first, then user)
  console.log('Test: Signup with storeName (new flow)');
  try {
    const res = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `test-store-creation-${Date.now()}@meridukaan.com`,
        password: 'password123',
        role: 'SALES',
        storeName: `Test Store ${Date.now()}`,
        storeRegion: 'Punjab',
        storeCity: 'Lahore',
      }),
    });
    const data = await res.json();
    if (res.ok) {
      console.log('✅ SUCCESS:');
      console.log('   User created:', data.user.email);
      console.log('   Store ID assigned:', data.user.storeId);
      console.log('   Token received:', data.access_token ? 'Yes' : 'No');
    } else {
      console.log('❌ FAILED:', data.message || data.error);
    }
  } catch (e: any) {
    console.log('❌ ERROR:', e.message);
  }
  console.log('');

  // Test: Signup with existing storeId (old flow still works)
  console.log('Test: Signup with existing storeId (backward compatible)');
  try {
    // First get a store
    const storesRes = await fetch(`${BACKEND_URL}/stores`);
    const stores = await storesRes.json();
    const existingStoreId = stores[0]?.id;

    if (existingStoreId) {
      const res = await fetch(`${BACKEND_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `test-existing-store-${Date.now()}@meridukaan.com`,
          password: 'password123',
          role: 'SALES',
          storeId: existingStoreId,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        console.log('✅ SUCCESS:');
        console.log('   User created:', data.user.email);
        console.log('   Store ID:', data.user.storeId);
      } else {
        console.log('❌ FAILED:', data.message || data.error);
      }
    } else {
      console.log('⚠️  SKIPPED: No existing stores found');
    }
  } catch (e: any) {
    console.log('❌ ERROR:', e.message);
  }
}

testSignupWithStoreName().catch(console.error);
