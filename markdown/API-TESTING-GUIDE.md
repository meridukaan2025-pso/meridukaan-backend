# API Testing Guide - Swagger Documentation

> ✅ **Verified:** This documentation matches the actual implementation in the codebase. All endpoints, headers, request/response formats, and error codes are accurate as of the latest code review.

## 🔐 Authentication Flow

### Step 1: Get JWT Token (Login)

**Endpoint:** `POST /auth/login`  
**Headers:** None required  
**Request Body:**
```json
{
  "email": "admin@meridukaan.com",
  "password": "password123"
}
```

**Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "admin@meridukaan.com",
    "role": "ADMIN",
    "storeId": null
  }
}
```

**How to use in Swagger:**
1. Open Swagger UI at `/api-docs`
2. Find `POST /auth/login` endpoint
3. Click "Try it out"
4. Enter email and password
5. Click "Execute"
6. Copy the `access_token` from response
7. Click "Authorize" button (top right) in Swagger UI
8. Enter: `Bearer <your-access-token>` (e.g., `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)
9. Click "Authorize" and "Close"

---

## 📋 Public Endpoints (No Authentication Required)

### 1. GET /stores

**Headers:** None  
**Request:** No body required

**Response (200 OK):**
```json
[
  {
    "id": "store-uuid-1",
    "name": "Store Karachi Central",
    "region": "Sindh",
    "city": "Karachi",
    "createdAt": "2026-01-15T10:00:00.000Z",
    "updatedAt": "2026-01-15T10:00:00.000Z"
  },
  {
    "id": "store-uuid-2",
    "name": "Store Lahore Main",
    "region": "Punjab",
    "city": "Lahore",
    "createdAt": "2026-01-15T10:00:00.000Z",
    "updatedAt": "2026-01-15T10:00:00.000Z"
  }
]
```

**Swagger Testing:**
- No authorization needed
- Click "Try it out" → "Execute"

---

### 2. POST /auth/signup

**Headers:** None  
**Request Body:**
```json
{
  "email": "newsales@meridukaan.com",
  "password": "securePassword123",
  "role": "SALES",
  "storeId": "store-uuid-from-get-stores"
}
```

**Response (201 Created):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "new-user-uuid",
    "email": "newsales@meridukaan.com",
    "role": "SALES",
    "storeId": "store-uuid-from-get-stores"
  }
}
```

**Error Responses:**
- **400 Bad Request:** Missing storeId for SALES role or invalid input
- **409 Conflict:** Email already exists

**Swagger Testing:**
- No authorization needed
- First call `GET /stores` to get a store ID
- Use that store ID in signup request

---

### 3. POST /auth/login

**Headers:** None  
**Request Body:**
```json
{
  "email": "admin@meridukaan.com",
  "password": "password123"
}
```

**Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "admin@meridukaan.com",
    "role": "ADMIN",
    "storeId": null
  }
}
```

**Error Responses:**
- **401 Unauthorized:** Invalid credentials

**Swagger Testing:**
- No authorization needed
- Use this to get token for protected endpoints

---

## 🔒 Protected Endpoints (Require JWT Token)

### Authorization Header Format

**Header Name:** `Authorization`  
**Header Value:** `Bearer <your-access-token>`

**Example:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

**In Swagger UI:**
1. Click "Authorize" button (🔓 icon, top right)
2. Enter: `Bearer <your-token>` (without quotes)
3. Click "Authorize"
4. All protected endpoints will now include this header automatically

---

## 👥 User Management Endpoints (ADMIN Only)

### 1. GET /users

**Headers:** 
- `Authorization: Bearer <token>` (Required)
- `Content-Type: application/json`

**Request:** No body required

**Response (200 OK):**
```json
[
  {
    "id": "user-uuid-1",
    "email": "admin@meridukaan.com",
    "role": "ADMIN",
    "storeId": null,
    "createdAt": "2026-01-15T10:00:00.000Z",
    "updatedAt": "2026-01-15T10:00:00.000Z",
    "store": null
  },
  {
    "id": "user-uuid-2",
    "email": "sales1@meridukaan.com",
    "role": "SALES",
    "storeId": "store-uuid",
    "createdAt": "2026-01-15T10:00:00.000Z",
    "updatedAt": "2026-01-15T10:00:00.000Z",
    "store": {
      "id": "store-uuid",
      "name": "Store Karachi Central",
      "city": "Karachi",
      "region": "Sindh"
    }
  }
]
```

**Error Responses:**
- **401 Unauthorized:** Missing or invalid token
- **403 Forbidden:** User doesn't have ADMIN role

**Swagger Testing:**
- Must authorize first (use admin token)
- Click "Try it out" → "Execute"

---

### 2. GET /users/:id

**Headers:** 
- `Authorization: Bearer <token>` (Required)

**Path Parameters:**
- `id` (string, required): User UUID

**Response (200 OK):**
```json
{
  "id": "user-uuid",
  "email": "sales1@meridukaan.com",
  "role": "SALES",
  "storeId": "store-uuid",
  "createdAt": "2026-01-15T10:00:00.000Z",
  "updatedAt": "2026-01-15T10:00:00.000Z",
  "store": {
    "id": "store-uuid",
    "name": "Store Karachi Central",
    "city": "Karachi",
    "region": "Sindh"
  }
}
```

**Error Responses:**
- **401 Unauthorized:** Missing or invalid token
- **403 Forbidden:** Not ADMIN
- **404 Not Found:** User not found

**Swagger Testing:**
- Authorize with admin token
- Enter user ID in path parameter
- Click "Execute"

---

### 3. PUT /users/:id

**Headers:** 
- `Authorization: Bearer <token>` (Required)
- `Content-Type: application/json`

**Path Parameters:**
- `id` (string, required): User UUID

**Request Body (all fields optional):**
```json
{
  "email": "updated@meridukaan.com",
  "password": "newPassword123",
  "role": "SALES",
  "storeId": "store-uuid"
}
```

**Response (200 OK):**
```json
{
  "id": "user-uuid",
  "email": "updated@meridukaan.com",
  "role": "SALES",
  "storeId": "store-uuid",
  "createdAt": "2026-01-15T10:00:00.000Z",
  "updatedAt": "2026-01-15T17:00:00.000Z",
  "store": {
    "id": "store-uuid",
    "name": "Store Karachi Central",
    "city": "Karachi",
    "region": "Sindh"
  }
}
```

**Error Responses:**
- **400 Bad Request:** Invalid input or store ID required for SALES role
- **401 Unauthorized:** Missing or invalid token
- **403 Forbidden:** Not ADMIN
- **404 Not Found:** User not found
- **409 Conflict:** Email already exists

**Swagger Testing:**
- Authorize with admin token
- Enter user ID in path
- Fill in request body (only fields you want to update)
- Click "Execute"

---

### 4. DELETE /users/:id

**Headers:** 
- `Authorization: Bearer <token>` (Required)

**Path Parameters:**
- `id` (string, required): User UUID

**Response (200 OK):**
```json
{
  "message": "User with ID <uuid> has been deleted successfully",
  "deletedUser": {
    "id": "user-uuid",
    "email": "deleted@meridukaan.com"
  }
}
```

**Error Responses:**
- **401 Unauthorized:** Missing or invalid token
- **403 Forbidden:** Not ADMIN
- **404 Not Found:** User not found

**Swagger Testing:**
- Authorize with admin token
- Enter user ID in path parameter
- Click "Execute"

---

## 🛒 POS Endpoints (SALES/ADMIN)

### 1. POST /pos/scan

**Headers:** 
- `Authorization: Bearer <token>` (Required)
- `Content-Type: application/json`

**Request Body:**
```json
{
  "qrValue": "COKE-330ML"
}
```

**Note:** `storeId` is automatically taken from your assigned store (SALES users)

**Response (200 OK):**
```json
{
  "product": {
    "id": "product-uuid",
    "sku": "COKE-330ML",
    "name": "Coca-Cola 330ml",
    "unitPrice": "35.00",
    "unitSizeMl": 330,
    "category": "Soft Drinks",
    "brand": "Coca-Cola",
    "manufacturer": "Coca-Cola Company"
  },
  "stockQty": 150
}
```

**Error Responses:**
- **400 Bad Request:** User not assigned to a store
- **401 Unauthorized:** Missing or invalid token
- **403 Forbidden:** Not SALES or ADMIN
- **404 Not Found:** Product not found

**Swagger Testing:**
- Authorize with SALES or ADMIN token
- Enter QR value (SKU) in request body
- Click "Execute"

---

### 2. POST /pos/invoices

**Headers:** 
- `Authorization: Bearer <token>` (Required)
- `Content-Type: application/json`
- `Idempotency-Key: optional-unique-key` (Optional - header name: `idempotency-key`)

**Request Body:**
```json
{
  "items": [
    {
      "productId": "product-uuid-1",
      "qty": 5
    },
    {
      "productId": "product-uuid-2",
      "qty": 3
    }
  ],
  "clientInvoiceRef": "INV-2026-001"
}
```

**Note:** 
- `storeId` is automatically taken from your assigned store (SALES users)
- `workerId` is automatically set to your user ID
- ADMIN can optionally specify `storeId` in request body

**Response (201 Created):**
```json
{
  "invoiceId": "invoice-uuid",
  "pdfUrl": "/storage/invoices/invoice-uuid.pdf",
  "totals": {
    "amount": "175.00",
    "items": 5
  },
  "createdAt": "2026-01-15T17:00:00.000Z"
}
```

**Error Responses:**
- **400 Bad Request:** Invalid input, insufficient stock, or user not assigned to store
- **401 Unauthorized:** Missing or invalid token
- **403 Forbidden:** Not SALES or ADMIN

**Swagger Testing:**
- Authorize with SALES or ADMIN token
- Fill in items array (get productIds from scan endpoint)
- Optionally add clientInvoiceRef
- Click "Execute"

---

### 3. GET /pos/invoices/:id

**Headers:** 
- `Authorization: Bearer <token>` (Required)

**Path Parameters:**
- `id` (string, required): Invoice UUID

**Response (200 OK):**
```json
{
  "id": "invoice-uuid",
  "storeId": "store-uuid",
  "workerId": "user-uuid",
  "totalAmount": "175.00",
  "totalItems": 5,
  "status": "COMPLETED",
  "clientInvoiceRef": "INV-2026-001",
  "pdfUrl": "/storage/invoices/invoice-uuid.pdf",
  "createdAt": "2026-01-15T17:00:00.000Z",
  "updatedAt": "2026-01-15T17:00:00.000Z",
  "items": [
    {
      "id": "item-uuid",
      "invoiceId": "invoice-uuid",
      "productId": "product-uuid",
      "qty": 5,
      "unitPrice": "35.00",
      "lineTotal": "175.00",
      "product": {
        "id": "product-uuid",
        "sku": "COKE-330ML",
        "name": "Coca-Cola 330ml",
        "brand": {
          "id": "brand-uuid",
          "name": "Coca-Cola"
        },
        "category": {
          "id": "category-uuid",
          "name": "Soft Drinks"
        },
        "manufacturer": {
          "id": "manufacturer-uuid",
          "name": "Coca-Cola Company"
        }
      }
    }
  ],
  "store": {
    "id": "store-uuid",
    "name": "Store Karachi Central",
    "region": "Sindh",
    "city": "Karachi"
  }
}
```

**Swagger Testing:**
- Authorize with token
- Enter invoice ID in path parameter
- Click "Execute"

---

### 4. GET /pos/invoices/:id/pdf

**Headers:** 
- `Authorization: Bearer <token>` (Required)

**Path Parameters:**
- `id` (string, required): Invoice UUID

**Response (200 OK):**
- Content-Type: `application/pdf`
- PDF file download

**Error Responses:**
- **404 Not Found:** PDF not found

**Swagger Testing:**
- Authorize with token
- Enter invoice ID in path parameter
- Click "Execute"
- PDF will download

---

## 📊 Admin Analytics Endpoints (ADMIN Only)

### 1. GET /admin/filters

**Headers:** 
- `Authorization: Bearer <token>` (Required)

**Response (200 OK):**
```json
{
  "regions": ["Sindh", "Punjab", "Islamabad Capital Territory"],
  "cities": ["Karachi", "Lahore", "Islamabad"],
  "stores": [
    {
      "id": "store-uuid",
      "name": "Store Karachi Central",
      "region": "Sindh",
      "city": "Karachi"
    }
  ],
  "categories": [
    {
      "id": "category-uuid",
      "name": "Soft Drinks",
      "parentId": null
    }
  ],
  "manufacturers": [
    {
      "id": "manufacturer-uuid",
      "name": "Coca-Cola Company"
    }
  ],
  "brands": [
    {
      "id": "brand-uuid",
      "name": "Coca-Cola",
      "manufacturerId": "manufacturer-uuid",
      "manufacturerName": "Coca-Cola Company"
    }
  ]
}
```

**Swagger Testing:**
- Authorize with admin token
- Click "Try it out" → "Execute"

---

### 2. GET /admin/analytics/summary

**Headers:** 
- `Authorization: Bearer <token>` (Required)

**Query Parameters (all optional):**
- `from` (string): Start date (YYYY-MM-DD)
- `to` (string): End date (YYYY-MM-DD)
- `storeId` (string): Filter by store
- `region` (string): Filter by region
- `city` (string): Filter by city
- `categoryId` (string): Filter by category
- `manufacturerId` (string): Filter by manufacturer
- `brandId` (string): Filter by brand

**Response (200 OK):**
```json
{
  "totalSales": "1000.00",
  "totalInvoices": 50,
  "averageOrderValue": "20.00",
  "totalItemsSold": 200,
  "distribution": 75.5,
  "weightedDistribution": 80.2,
  "shareInShops": 65.3
}
```

**Swagger Testing:**
- Authorize with admin token
- Optionally add query parameters
- Click "Try it out" → "Execute"

---

### 3. GET /admin/analytics/sales-trend

**Headers:** 
- `Authorization: Bearer <token>` (Required)

**Query Parameters:** Same as `/admin/analytics/summary`

**Response (200 OK):**
```json
{
  "trends": [...]
}
```

**Swagger Testing:**
- Authorize with admin token
- Add query parameters if needed
- Click "Try it out" → "Execute"

---

### 4. GET /admin/analytics/brand-distribution

**Headers:** 
- `Authorization: Bearer <token>` (Required)

**Query Parameters:** Same as `/admin/analytics/summary`

**Response (200 OK):**
```json
{
  "distribution": [...]
}
```

**Swagger Testing:**
- Authorize with admin token
- Add query parameters if needed
- Click "Try it out" → "Execute"

---

### 5. GET /admin/analytics/market-share

**Headers:** 
- `Authorization: Bearer <token>` (Required)

**Query Parameters:** Same as `/admin/analytics/summary`

**Response (200 OK):**
```json
{
  "marketShare": [...]
}
```

**Swagger Testing:**
- Authorize with admin token
- Add query parameters if needed
- Click "Try it out" → "Execute"

---

### 6. GET /admin/analytics/brands

**Headers:** 
- `Authorization: Bearer <token>` (Required)

**Query Parameters:** Same as `/admin/analytics/summary`

**Response (200 OK):**
```json
{
  "brands": [...]
}
```

**Swagger Testing:**
- Authorize with admin token
- Add query parameters if needed
- Click "Try it out" → "Execute"

---

### 7. GET /admin/analytics/top-skus

**Headers:** 
- `Authorization: Bearer <token>` (Required)

**Query Parameters:** Same as `/admin/analytics/summary`

**Response (200 OK):**
```json
{
  "topSkus": [...]
}
```

**Swagger Testing:**
- Authorize with admin token
- Add query parameters if needed
- Click "Try it out" → "Execute"

---

## 🧪 Complete Testing Workflow in Swagger

### Step-by-Step Guide:

1. **Open Swagger UI:**
   - Navigate to `https://your-domain.com/api-docs`

2. **Get Stores (Optional - for signup):**
   - Find `GET /stores`
   - Click "Try it out" → "Execute"
   - Copy a store ID from response

3. **Login to Get Token:**
   - Find `POST /auth/login`
   - Click "Try it out"
   - Enter: `{"email": "admin@meridukaan.com", "password": "password123"}`
   - Click "Execute"
   - Copy the `access_token` from response

4. **Authorize in Swagger:**
   - Click "Authorize" button (🔓 icon, top right)
   - Enter: `Bearer <your-access-token>`
   - Click "Authorize" → "Close"
   - All protected endpoints now have authorization

5. **Test Protected Endpoints:**
   - All endpoints now show 🔒 (locked) icon
   - Click any endpoint → "Try it out"
   - Fill in required fields
   - Click "Execute"
   - View response

6. **Test Different Roles:**
   - Login as different users (sales1, admin, etc.)
   - Re-authorize with new token
   - Test role-based access

---

## 📝 Quick Reference

### Headers Summary:

| Endpoint | Authorization Required | Content-Type | Other Headers |
|----------|----------------------|--------------|---------------|
| GET /stores | ❌ No | - | - |
| POST /auth/login | ❌ No | application/json | - |
| POST /auth/signup | ❌ No | application/json | - |
| GET /users | ✅ Yes (ADMIN) | - | - |
| GET /users/:id | ✅ Yes (ADMIN) | - | - |
| PUT /users/:id | ✅ Yes (ADMIN) | application/json | - |
| DELETE /users/:id | ✅ Yes (ADMIN) | - | - |
| POST /pos/scan | ✅ Yes (SALES/ADMIN) | application/json | - |
| POST /pos/invoices | ✅ Yes (SALES/ADMIN) | application/json | Idempotency-Key (optional) |
| GET /pos/invoices/:id | ✅ Yes (SALES/ADMIN/INVENTORY) | - | - |
| GET /pos/invoices/:id/pdf | ✅ Yes (SALES/ADMIN/INVENTORY) | - | - |
| GET /admin/filters | ✅ Yes (ADMIN) | - | - |
| GET /admin/analytics/* | ✅ Yes (ADMIN) | - | Query params (optional) |

### Default Credentials:

- **Admin:** `admin@meridukaan.com` / `password123`
- **Sales 1:** `sales1@meridukaan.com` / `password123`
- **Sales 2:** `sales2@meridukaan.com` / `password123`
- **Inventory:** `inventory@meridukaan.com` / `password123`
- **Purchase:** `purchase@meridukaan.com` / `password123`

---

## ⚠️ Common Errors

- **401 Unauthorized:** Token missing, expired, or invalid → Re-login and re-authorize
- **403 Forbidden:** Wrong role → Use correct user account
- **400 Bad Request:** Invalid input → Check request body format
- **404 Not Found:** Resource doesn't exist → Check IDs are correct
- **409 Conflict:** Duplicate email → Use different email
