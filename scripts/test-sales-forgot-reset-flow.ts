/**
 * Tests the sales forgot-password flow (link-based, no OTP):
 * 1. POST /auth/sales/forgot-password with phone → get resetUrl
 * 2. Parse token from resetUrl
 * 3. POST /auth/sales/reset-password with phone, token, newPassword
 * 4. POST /auth/login with email + newPassword to verify
 *
 * Ensure backend is running (e.g. npm run start:dev) and test user exists:
 *   npx ts-node scripts/seed-test-sales-forgot-reset.ts
 *
 * Run: BASE_URL=http://localhost:3001 npx ts-node scripts/test-sales-forgot-reset-flow.ts
 */
const BASE_URL = (process.env.BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const TEST_PHONE = '+923001234567';
const TEST_EMAIL = 'test.sales.reset@meridukaan.com';
const NEW_PASSWORD = 'NewTest@456';

async function requestReset(): Promise<{ token: string; phoneNumber: string } | null> {
  const res = await fetch(`${BASE_URL}/auth/sales/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phoneNumber: TEST_PHONE,
      redirectUrl: `${BASE_URL}/sales/reset-password`,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('❌ Forgot password request failed:', res.status, data);
    return null;
  }
  if (!data.resetUrl) {
    console.error('❌ No resetUrl in response (user may not exist for this phone).', data);
    return null;
  }
  const url = new URL(data.resetUrl);
  const token = url.searchParams.get('token');
  const phoneNumber = url.searchParams.get('phoneNumber');
  const decodedPhone = phoneNumber ? decodeURIComponent(phoneNumber) : null;
  if (!token || !decodedPhone) {
    console.error('❌ Could not parse token or phoneNumber from resetUrl:', data.resetUrl);
    return null;
  }
  return { token, phoneNumber: decodedPhone };
}

async function resetPassword(phoneNumber: string, token: string, newPassword: string): Promise<boolean> {
  const res = await fetch(`${BASE_URL}/auth/sales/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber, token, newPassword }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('❌ Reset password failed:', res.status, data);
    return false;
  }
  return true;
}

async function verifyLogin(email: string, password: string): Promise<boolean> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('❌ Login failed:', res.status, data);
    return false;
  }
  if (!data.access_token && !data.token) {
    console.error('❌ No token in login response.');
    return false;
  }
  return true;
}

async function main() {
  console.log('Testing sales forgot-password flow (link-based)...\n');
  console.log('Step 1: Request reset for', TEST_PHONE);
  const parsed = await requestReset();
  if (!parsed) process.exit(1);
  console.log('  ✅ Got reset token\n');

  console.log('Step 2: Reset password to', NEW_PASSWORD);
  const ok = await resetPassword(parsed.phoneNumber, parsed.token, NEW_PASSWORD);
  if (!ok) process.exit(1);
  console.log('  ✅ Password updated\n');

  console.log('Step 3: Verify login with new password');
  const loginOk = await verifyLogin(TEST_EMAIL, NEW_PASSWORD);
  if (!loginOk) process.exit(1);
  console.log('  ✅ Login successful\n');

  console.log('✅ Full flow passed. Sales user can now sign in with:');
  console.log('   Email:', TEST_EMAIL);
  console.log('   Password:', NEW_PASSWORD);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
