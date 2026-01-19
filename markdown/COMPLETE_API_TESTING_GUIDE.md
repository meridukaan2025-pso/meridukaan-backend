# Complete API Testing Guide - Step by Step
# مکمل API ٹیسٹنگ گائیڈ - مرحلہ وار

> **Yeh guide aapko sab APIs ko sequence mein test karne mein madad karega**  
> **یہ گائیڈ آپ کو تمام APIs کو ترتیب سے ٹیسٹ کرنے میں مدد کرے گی**

---

## 📋 Table of Contents / فہرست

1. [Setup aur Preparation](#setup-aur-preparation)
2. [Step 1: Public APIs (Bina Token ke)](#step-1-public-apis)
3. [Step 2: Authentication](#step-2-authentication)
4. [Step 3: Products Management](#step-3-products-management)
5. [Step 4: POS Operations](#step-4-pos-operations)
6. [Step 5: Invoice Management](#step-5-invoice-management)
7. [Step 6: Admin Operations](#step-6-admin-operations)
8. [Step 7: User Management (Admin Only)](#step-7-user-management)
9. [Complete Testing Checklist](#complete-testing-checklist)

---

## 🚀 Setup aur Preparation

### Prerequisites:
- ✅ Backend server running on `http://localhost:3001`
- ✅ Swagger UI available at `http://localhost:3001/api-docs`
- ✅ Browser mein Swagger UI kholi hui ho

### Default Credentials (Seed Data):

| Role | Email | Password | Store ID |
|------|-------|----------|----------|
| **Admin** | `admin@meridukaan.com` | `password123` | Auto-assigned |
| **Sales 1** | `sales1@meridukaan.com` | `password123` | Auto-assigned |
| **Sales 2** | `sales2@meridukaan.com` | `password123` | Auto-assigned |
| **Inventory** | `inventory@meridukaan.com` | `password123` | Auto-assigned |
| **Purchase** | `purchase@meridukaan.com` | `password123` | Auto-assigned |

---

## Step 1: Public APIs (Bina Token ke)

### ✅ Test 1.1: Health Check
**Endpoint:** `GET /health`

**Swagger mein:**
1. Swagger UI kholo: `http://localhost:3001/api-docs`
2. Root endpoint `/` ya `/health` dhoondo
3. "Try it out" click karo
4. "Execute" click karo

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-17T..."
}
```

**✅ Status:** Server running hai

---

### ✅ Test 1.2: Get All Stores
**Endpoint:** `GET /stores`

**Swagger mein:**
1. "Stores" section mein jao
2. `GET /stores` endpoint kholo
3. "Try it out" → "Execute"

**Expected Response:**
```json
[
  {
    "id": "store-uuid-1",
    "name": "Store Karachi Central",
    "region": "Sindh",
    "city": "Karachi",
    "createdAt": "2026-01-14T...",
    "updatedAt": "2026-01-14T..."
  }
]
```

**✅ Status:** Stores list mil gayi  
**📝 Note:** Store IDs ko note karlo, signup ke liye zaroori hain

---

## Step 2: Authentication

### ✅ Test 2.1: User Login (Admin)
**Endpoint:** `POST /auth/login`

**Swagger mein:**
1. "Authentication" section mein jao
2. `POST /auth/login` kholo
3. "Try it out" click karo
4. Request body mein:
```json
{
  "email": "admin@meridukaan.com",
  "password": "password123"
}
```
5. "Execute" click karo

**Expected Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-uuid",
    "email": "admin@meridukaan.com",
    "role": "ADMIN",
    "storeId": null
  }
}
```

**✅ Status:** Login successful  
**📝 Important:** `access_token` ko copy karlo, baad mein use hoga

---

### ✅ Test 2.2: Authorize in Swagger
**Swagger UI mein Token add karo:**

1. Swagger UI ke top right corner mein **"Authorize"** button (🔓) click karo
2. `Value` field mein paste karo: `Bearer <your-access-token>`
   - Example: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
3. "Authorize" click karo
4. "Close" click karo

**✅ Status:** Ab sab protected endpoints mein automatically token add ho jayega

---

### ✅ Test 2.3: User Login (Sales)
**Endpoint:** `POST /auth/login`

**Request Body:**
```json
{
  "email": "sales1@meridukaan.com",
  "password": "password123"
}
```

**Expected Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "sales-user-uuid",
    "email": "sales1@meridukaan.com",
    "role": "SALES",
    "storeId": "store-uuid"
  }
}
```

**✅ Status:** Sales user login successful  
**📝 Note:** Sales user ka `storeId` automatically set hai

---

### ✅ Test 2.4: User Signup (Optional - New User)
**Endpoint:** `POST /auth/signup`

**Swagger mein:**
1. `POST /auth/signup` endpoint kholo
2. Request body:
```json
{
  "email": "newsales@meridukaan.com",
  "password": "password123",
  "role": "SALES",
  "storeId": "store-uuid-from-step-1.2"
}
```

**Expected Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "new-user-uuid",
    "email": "newsales@meridukaan.com",
    "role": "SALES",
    "storeId": "store-uuid"
  }
}
```

**✅ Status:** New user created successfully

---

## Step 3: Products Management

### ✅ Test 3.1: Get All Products
**Endpoint:** `GET /products`

**Swagger mein:**
1. "Products" section mein jao
2. `GET /products` kholo
3. "Try it out" → "Execute"

**Expected Response:**
```json
[
  {
    "id": "product-uuid",
    "sku": "COKE-330ML",
    "name": "Coca-Cola 330ml",
    "unitPrice": "35.00",
    "category": {...},
    "brand": {...},
    "manufacturer": {...}
  }
]
```

**✅ Status:** Products list mil gayi  
**📝 Note:** Product IDs ko note karlo, invoice creation ke liye zaroori hain

---

### ✅ Test 3.2: Get Product by SKU
**Endpoint:** `GET /products/sku/{sku}`

**Swagger mein:**
1. `GET /products/sku/{sku}` kholo
2. `sku` parameter mein: `COKE-330ML` (ya koi existing SKU)
3. "Execute" click karo

**Expected Response:**
```json
{
  "id": "product-uuid",
  "sku": "COKE-330ML",
  "name": "Coca-Cola 330ml",
  "unitPrice": "35.00"
}
```

**✅ Status:** Product by SKU mil gaya

---

### ✅ Test 3.3: Quick Create Product (POS Scenario)
**Endpoint:** `POST /products/quick-create`

**Swagger mein:**
1. `POST /products/quick-create` kholo
2. Request body:
```json
{
  "sku": "NEW-PRODUCT-001",
  "name": "New Product Name",
  "categoryName": "Soft Drinks",
  "brandName": "New Brand",
  "manufacturerName": "New Manufacturer",
  "unitPrice": 50.00,
  "unitSizeMl": 500
}
```

**Expected Response:**
```json
{
  "id": "new-product-uuid",
  "sku": "NEW-PRODUCT-001",
  "name": "New Product Name",
  "unitPrice": "50.00",
  "category": {...},
  "brand": {...},
  "manufacturer": {...}
}
```

**✅ Status:** Product quick create successful  
**📝 Note:** Category, brand, manufacturer automatically create ho gaye

---

## Step 4: POS Operations

### ✅ Test 4.1: Scan Product (QR Code)
**Endpoint:** `POST /pos/scan`

**Swagger mein:**
1. "POS" section mein jao
2. `POST /pos/scan` kholo
3. Request body:
```json
{
  "storeId": "store-uuid",
  "qrValue": "COKE-330ML"
}
```

**Expected Response:**
```json
{
  "product": {
    "id": "product-uuid",
    "sku": "COKE-330ML",
    "name": "Coca-Cola 330ml",
    "unitPrice": "35.00"
  },
  "stockQty": 50
}
```

**✅ Status:** Product scan successful  
**📝 Note:** `product.id` ko note karlo, invoice creation ke liye zaroori hai

---

### ✅ Test 4.2: Create Invoice
**Endpoint:** `POST /pos/invoices`

**⚠️ IMPORTANT for SALES users:**
- **Do NOT pass `storeId`** in request body - it will be automatically set to your assigned store
- If you pass `storeId`, it must match your assigned store, otherwise you'll get 400 error

**Swagger mein:**
1. `POST /pos/invoices` kholo
2. **Headers section mein:**
   - `idempotency-key`: `unique-key-123` (optional, duplicate prevent karne ke liye)
3. Request body (SALES users - storeId mat do):
```json
{
  "items": [
    {
      "productId": "product-uuid-from-scan",
      "qty": 5
    },
    {
      "productId": "another-product-uuid",
      "qty": 3
    }
  ],
  "clientInvoiceRef": "INV-2026-001"
}
```

**Request body (ADMIN users - storeId optional):**
```json
{
  "storeId": "store-uuid",  // Optional for ADMIN
  "items": [
    {
      "productId": "product-uuid-from-scan",
      "qty": 5
    }
  ],
  "clientInvoiceRef": "INV-2026-001"
}
```

**Expected Response:**
```json
{
  "id": "invoice-uuid",
  "storeId": "store-uuid",
  "workerId": "user-uuid",
  "totalAmount": "175.00",
  "totalItems": 8,
  "status": "COMPLETED",
  "pdfUrl": "/storage/invoices/invoice-uuid.pdf",
  "items": [...],
  "createdAt": "2026-01-17T..."
}
```

**✅ Status:** Invoice created successfully  
**📝 Important:** 
- **SALES users:** `storeId` automatically set hota hai (apne assigned store se) - request mein mat do
- **ADMIN users:** `storeId` optional hai - specify kar sakte ho ya assigned store use hoga
- `workerId` automatically set hota hai (current user)
- `invoice.id` ko note karlo, baad mein use hoga

**⚠️ Common Error:**
- Agar SALES user `storeId` pass kare jo unke assigned store se match nahi karta → 400 Bad Request
- Solution: `storeId` field hata do ya apne assigned store ka ID do

---

## Step 5: Invoice Management

### ✅ Test 5.1: Get Invoice Details
**Endpoint:** `GET /pos/invoices/{id}`

**Swagger mein:**
1. `GET /pos/invoices/{id}` kholo
2. `id` parameter mein: `invoice-uuid-from-step-4.2`
3. "Execute" click karo

**Expected Response:**
```json
{
  "id": "invoice-uuid",
  "storeId": "store-uuid",
  "workerId": "user-uuid",
  "totalAmount": "175.00",
  "totalItems": 8,
  "status": "COMPLETED",
  "items": [
    {
      "id": "item-uuid",
      "productId": "product-uuid",
      "qty": 5,
      "unitPrice": "35.00",
      "lineTotal": "175.00",
      "product": {...}
    }
  ],
  "store": {...}
}
```

**✅ Status:** Invoice details mil gaye

---

### ✅ Test 5.2: Download Invoice PDF
**Endpoint:** `GET /pos/invoices/{id}/pdf`

**Swagger mein:**
1. `GET /pos/invoices/{id}/pdf` kholo
2. `id` parameter mein: `invoice-uuid`
3. "Execute" click karo

**Expected Response:**
- PDF file download hogi
- Browser mein PDF open ho jayegi

**✅ Status:** PDF download successful

---

## Step 6: Admin Operations

### ✅ Test 6.1: Get Admin Filters
**Endpoint:** `GET /admin/filters`

**Swagger mein:**
1. "Admin" section mein jao
2. `GET /admin/filters` kholo
3. "Execute" click karo

**Expected Response:**
```json
{
  "regions": ["Punjab", "Sindh", "Islamabad Capital Territory"],
  "cities": ["Lahore", "Karachi", "Islamabad"],
  "stores": [...],
  "categories": [...],
  "manufacturers": [...],
  "brands": [...]
}
```

**✅ Status:** Filters mil gaye  
**📝 Note:** Admin dashboard ke liye filters available hain

---

### ✅ Test 6.2: Get Analytics Summary
**Endpoint:** `GET /admin/analytics/summary`

**Swagger mein:**
1. `GET /admin/analytics/summary` kholo
2. Query parameters (optional):
   - `from`: `2026-01-01`
   - `to`: `2026-12-31`
   - `storeId`: `store-uuid` (optional)
   - `region`: `Sindh` (optional)
   - `city`: `Karachi` (optional)
3. "Execute" click karo

**Expected Response:**
```json
{
  "salesValue": "50000.00",
  "salesVolume": 150,
  "distribution": 75.5,
  "weightedDistribution": 75.5,
  "shareInShops": 60.0,
  "avgPricePerLitre": "45.50",
  "avgPricePerSKU": "333.33"
}
```

**✅ Status:** Analytics summary mil gaya

---

### ✅ Test 6.3: Get Sales Trend
**Endpoint:** `GET /admin/analytics/sales-trend`

**Swagger mein:**
1. `GET /admin/analytics/sales-trend` kholo
2. Query parameters:
   - `from`: `2026-01-01`
   - `to`: `2026-12-31`
   - `bucket`: `daily` (ya `weekly`)
3. "Execute" click karo

**Expected Response:**
```json
{
  "bucket": "daily",
  "series": [
    {
      "date": "2026-01-09",
      "salesValue": "5000.00",
      "salesVolume": 25
    }
  ]
}
```

**✅ Status:** Sales trend data mil gaya

---

### ✅ Test 6.4: Get Brand Distribution
**Endpoint:** `GET /admin/analytics/brand-distribution`

**Swagger mein:**
1. `GET /admin/analytics/brand-distribution` kholo
2. Query parameters (optional):
   - `from`: `2026-01-01`
   - `to`: `2026-12-31`
   - `storeId`: `store-uuid`
3. "Execute" click karo

**Expected Response:**
```json
{
  "rows": [
    {
      "brandId": "brand-uuid",
      "brandName": "Coca-Cola",
      "salesValue": "10000.00",
      "salesVolume": 50
    }
  ]
}
```

**✅ Status:** Brand distribution data mil gaya

---

### ✅ Test 6.5: Get Market Share
**Endpoint:** `GET /admin/analytics/market-share`

**Swagger mein:**
1. `GET /admin/analytics/market-share` kholo
2. Query parameters:
   - `from`: `2026-01-01`
   - `to`: `2026-12-31`
   - `metric`: `value` (ya `volume`)
   - `brandId`: `brand-uuid` (optional)
3. "Execute" click karo

**Expected Response:**
```json
{
  "metric": "value",
  "slices": [
    {
      "label": "Brand Name",
      "value": 45.5
    }
  ]
}
```

**✅ Status:** Market share data mil gaya

---

### ✅ Test 6.6: Get Brands List
**Endpoint:** `GET /admin/analytics/brands`

**Swagger mein:**
1. `GET /admin/analytics/brands` kholo
2. Query parameters:
   - `from`: `2026-01-01`
   - `to`: `2026-12-31`
   - `page`: `1`
   - `pageSize`: `10`
   - `sort`: `salesValue`
3. "Execute" click karo

**Expected Response:**
```json
{
  "rows": [
    {
      "brandId": "brand-uuid",
      "brandName": "Coca-Cola",
      "salesValue": "10000.00",
      "shareValue": "20.00",
      "avgPrice": "200.00",
      "avgPricePerLitre": "45.50"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 50,
    "totalPages": 5
  }
}
```

**✅ Status:** Brands list mil gayi

---

### ✅ Test 6.7: Get Top SKUs
**Endpoint:** `GET /admin/analytics/top-skus`

**Swagger mein:**
1. `GET /admin/analytics/top-skus` kholo
2. Query parameters:
   - `from`: `2026-01-01`
   - `to`: `2026-12-31`
   - `limit`: `10`
3. "Execute" click karo

**Expected Response:**
```json
{
  "rows": [
    {
      "sku": "COKE-330ML",
      "name": "Coca-Cola 330ml",
      "brandName": "Coca-Cola",
      "salesValue": "5000.00",
      "salesVolume": 25
    }
  ]
}
```

**✅ Status:** Top SKUs mil gaye

---

## Step 7: User Management (Admin Only)

### ✅ Test 7.1: Get All Users
**Endpoint:** `GET /users`

**Swagger mein:**
1. "Users" section mein jao
2. `GET /users` kholo
3. "Execute" click karo

**Expected Response:**
```json
[
  {
    "id": "user-uuid",
    "email": "sales1@meridukaan.com",
    "role": "SALES",
    "storeId": "store-uuid",
    "createdAt": "2026-01-14T...",
    "updatedAt": "2026-01-14T..."
  }
]
```

**✅ Status:** Users list mil gayi

---

### ✅ Test 7.2: Get User by ID
**Endpoint:** `GET /users/{id}`

**Swagger mein:**
1. `GET /users/{id}` kholo
2. `id` parameter mein: `user-uuid-from-step-7.1`
3. "Execute" click karo

**Expected Response:**
```json
{
  "id": "user-uuid",
  "email": "sales1@meridukaan.com",
  "role": "SALES",
  "storeId": "store-uuid"
}
```

**✅ Status:** User details mil gaye

---

### ✅ Test 7.3: Update User
**Endpoint:** `PUT /users/{id}`

**Swagger mein:**
1. `PUT /users/{id}` kholo
2. `id` parameter mein: `user-uuid`
3. Request body:
```json
{
  "email": "updated@meridukaan.com",
  "role": "SALES",
  "storeId": "store-uuid"
}
```

**Expected Response:**
```json
{
  "id": "user-uuid",
  "email": "updated@meridukaan.com",
  "role": "SALES",
  "storeId": "store-uuid",
  "updatedAt": "2026-01-17T..."
}
```

**✅ Status:** User updated successfully

---

### ✅ Test 7.4: Delete User (Optional - Careful!)
**Endpoint:** `DELETE /users/{id}`

**⚠️ Warning:** Yeh permanent delete hai!

**Swagger mein:**
1. `DELETE /users/{id}` kholo
2. `id` parameter mein: `user-uuid` (jo delete karna hai)
3. "Execute" click karo

**Expected Response:**
```json
{
  "message": "User deleted successfully"
}
```

**✅ Status:** User deleted (agar test karna ho)

---

## Complete Testing Checklist

### ✅ Public APIs
- [ ] GET /health
- [ ] GET /stores

### ✅ Authentication
- [ ] POST /auth/login (Admin)
- [ ] POST /auth/login (Sales)
- [ ] POST /auth/signup (Optional)
- [ ] Swagger mein Authorize kiya

### ✅ Products
- [ ] GET /products (List all)
- [ ] GET /products/sku/{sku} (Get by SKU)
- [ ] POST /products/quick-create (Quick create)
- [ ] POST /products (Full create - Admin/Inventory)

### ✅ POS Operations
- [ ] POST /pos/scan (Scan product)
- [ ] POST /pos/invoices (Create invoice)
  - [ ] With idempotency-key header
  - [ ] Without idempotency-key header

### ✅ Invoice Management
- [ ] GET /pos/invoices/{id} (Get invoice details)
- [ ] GET /pos/invoices/{id}/pdf (Download PDF)

### ✅ Admin Analytics
- [ ] GET /admin/filters
- [ ] GET /admin/analytics/summary
- [ ] GET /admin/analytics/sales-trend
- [ ] GET /admin/analytics/brand-distribution
- [ ] GET /admin/analytics/market-share
- [ ] GET /admin/analytics/brands
- [ ] GET /admin/analytics/top-skus

### ✅ User Management (Admin)
- [ ] GET /users (List all)
- [ ] GET /users/{id} (Get by ID)
- [ ] PUT /users/{id} (Update)
- [ ] DELETE /users/{id} (Delete - Optional)

---

## 🎯 Complete Flow Example

### Complete POS Flow (End-to-End):

1. **Login as Sales User:**
   ```
   POST /auth/login
   → Get token
   → Authorize in Swagger
   ```

2. **Scan Products:**
   ```
   POST /pos/scan (Product 1)
   POST /pos/scan (Product 2)
   → Get product IDs
   ```

3. **Create Invoice:**
   ```
   POST /pos/invoices
   Headers: idempotency-key: unique-123
   Body: {
     "items": [
       {"productId": "product-1-id", "qty": 5},
       {"productId": "product-2-id", "qty": 3}
     ]
   }
   → Get invoice ID
   ```

4. **View Invoice:**
   ```
   GET /pos/invoices/{invoice-id}
   → View details
   ```

5. **Download PDF:**
   ```
   GET /pos/invoices/{invoice-id}/pdf
   → Download PDF
   ```

---

## ⚠️ Common Errors aur Solutions

### 401 Unauthorized
**Problem:** Token missing ya expired  
**Solution:** 
- Re-login karo
- Swagger mein dobara Authorize karo

### 403 Forbidden
**Problem:** Wrong role  
**Solution:** 
- Sahi role wale user se login karo
- Admin operations ke liye Admin user use karo

### 400 Bad Request
**Problem:** Invalid input  
**Common causes:**
- Request body format galat hai
- Required fields missing hain
- Data types sahi nahi hain
- **SALES user ne galat storeId pass kiya** (jo unke assigned store se match nahi karta)

**Solution:** 
- Request body check karo
- Required fields verify karo
- Data types sahi hain ya nahi check karo
- **SALES users:** `storeId` field hata do ya apne assigned store ka ID do

### 404 Not Found
**Problem:** Resource nahi mila  
**Solution:** 
- IDs sahi hain ya nahi check karo
- Pehle resource create karo (product, store, etc.)

### 409 Conflict
**Problem:** Duplicate (email, SKU, etc.)  
**Solution:** 
- Unique value use karo
- Existing resource check karo

---

## 📝 Important Notes

1. **Token Expiry:** Tokens 1 hour ke baad expire hote hain
2. **Store ID (⚠️ VERY IMPORTANT):** 
   - **SALES users:** `storeId` request mein mat do - automatically apne assigned store se set ho jayega
   - Agar SALES user `storeId` pass kare jo unke assigned store se match nahi karta → 400 error
   - **ADMIN users:** `storeId` optional hai - specify kar sakte ho ya assigned store use hoga
3. **Worker ID:** Har invoice ka workerId automatically current user se set hota hai
4. **Idempotency Key:** Optional hai, duplicate prevent karne ke liye use karo
5. **Role Restrictions:** 
   - SALES: Sirf apne store ke liye invoices create kar sakte hain (storeId automatically set)
   - ADMIN: Sab kuch kar sakte hain (storeId optional)
   - INVENTORY/PURCHASE: Products manage kar sakte hain

---

## 🎉 Testing Complete!

Agar sab tests pass ho gaye hain, toh:
- ✅ APIs sahi kaam kar rahi hain
- ✅ Authentication working hai
- ✅ Role-based access control working hai
- ✅ All endpoints functional hain

**Happy Testing! 🚀**

---

**Last Updated:** 2026-01-17  
**Version:** 1.0.0
