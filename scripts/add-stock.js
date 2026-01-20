#!/usr/bin/env node

/**
 * Script to add stock to a product in a store
 * Usage: node scripts/add-stock.js <productId> <storeId> <quantity>
 */

const http = require('http');

const BASE_URL = process.env.API_URL || 'http://localhost:3001';
const [,, productId, storeId, quantity] = process.argv;

if (!productId || !storeId || !quantity) {
  console.error('Usage: node scripts/add-stock.js <productId> <storeId> <quantity>');
  process.exit(1);
}

async function addStock() {
  try {
    // Login as admin
    const loginResponse = await makeRequest('POST', '/auth/login', {
      body: {
        email: 'admin@meridukaan.com',
        password: 'password123',
      },
    });

    if (loginResponse.status !== 200 && loginResponse.status !== 201) {
      throw new Error('Login failed');
    }

    const token = loginResponse.data.access_token;
    console.log('✅ Logged in successfully');

    // Get product details
    const productsResponse = await makeRequest('GET', '/products', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const product = productsResponse.data.find(p => p.id === productId);
    if (!product) {
      console.error(`❌ Product with ID ${productId} not found`);
      process.exit(1);
    }

    console.log(`\n📦 Product Found:`);
    console.log(`   ID: ${product.id}`);
    console.log(`   SKU: ${product.sku}`);
    console.log(`   Name: ${product.name}`);

    // Use Prisma directly to update inventory
    // Since there's no API endpoint, we'll use a workaround
    console.log(`\n⚠️  Note: There's no API endpoint to update inventory directly.`);
    console.log(`   You need to use Prisma Studio or database directly.`);
    console.log(`\n📝 SQL to add stock:`);
    console.log(`   UPDATE inventory SET qty_on_hand = qty_on_hand + ${quantity}`);
    console.log(`   WHERE store_id = '${storeId}' AND product_id = '${productId}';`);
    
    console.log(`\n✅ Stock addition instructions provided`);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

function makeRequest(method, path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const requestOptions = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    const req = http.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const jsonData = data ? JSON.parse(data) : {};
          resolve({
            status: res.statusCode,
            data: jsonData,
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data,
          });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

addStock();
