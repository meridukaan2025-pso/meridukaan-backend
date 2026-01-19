# API Flow Documentation

> Complete guide showing which APIs are implemented and how they work together

---

## 📋 Table of Contents

1. [API Overview](#api-overview)
2. [Authentication Flow](#authentication-flow)
3. [User Registration Flow](#user-registration-flow)
4. [POS (Point of Sale) Flow](#pos-point-of-sale-flow)
5. [User Management Flow (Admin)](#user-management-flow-admin)
6. [Admin Analytics Flow](#admin-analytics-flow)
7. [Complete Workflow Examples](#complete-workflow-examples)

---

## 🎯 API Overview

### Implemented Endpoints Summary

| Category | Endpoint | Method | Auth Required | Role Required |
|----------|----------|--------|---------------|---------------|
| **Public** | `/stores` | GET | ❌ No | - |
| **Auth** | `/auth/login` | POST | ❌ No | - |
| **Auth** | `/auth/signup` | POST | ❌ No | - |
| **Users** | `/users` | GET | ✅ Yes | ADMIN |
| **Users** | `/users/:id` | GET | ✅ Yes | ADMIN |
| **Users** | `/users/:id` | PUT | ✅ Yes | ADMIN |
| **Users** | `/users/:id` | DELETE | ✅ Yes | ADMIN |
| **POS** | `/pos/scan` | POST | ✅ Yes | SALES/ADMIN |
| **POS** | `/pos/invoices` | POST | ✅ Yes | SALES/ADMIN |
| **POS** | `/pos/invoices/:id` | GET | ✅ Yes | SALES/ADMIN/INVENTORY |
| **POS** | `/pos/invoices/:id/pdf` | GET | ✅ Yes | SALES/ADMIN/INVENTORY |
| **Admin** | `/admin/filters` | GET | ✅ Yes | ADMIN |
| **Admin** | `/admin/analytics/summary` | GET | ✅ Yes | ADMIN |
| **Admin** | `/admin/analytics/sales-trend` | GET | ✅ Yes | ADMIN |
| **Admin** | `/admin/analytics/brand-distribution` | GET | ✅ Yes | ADMIN |
| **Admin** | `/admin/analytics/market-share` | GET | ✅ Yes | ADMIN |
| **Admin** | `/admin/analytics/brands` | GET | ✅ Yes | ADMIN |
| **Admin** | `/admin/analytics/top-skus` | GET | ✅ Yes | ADMIN |

---

## 🔐 Authentication Flow

### Step-by-Step Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION FLOW                       │
└─────────────────────────────────────────────────────────────┘

1. User wants to access protected APIs
   │
   ├─→ Option A: New User (Signup)
   │   │
   │   └─→ POST /auth/signup
   │       ├─ Request: { email, password, role, storeId? }
   │       └─ Response: { access_token, user }
   │
   └─→ Option B: Existing User (Login)
       │
       └─→ POST /auth/login
           ├─ Request: { email, password }
           └─ Response: { access_token, user }

2. Copy access_token from response

3. Use token in Authorization header for all protected APIs
   Header: Authorization: Bearer <access_token>

4. Token is valid until expiration (default: 1 hour)
   If expired → Re-login to get new token
```

### Example Sequence

```javascript
// Step 1: Login
POST /auth/login
Body: {
  "email": "sales1@meridukaan.com",
  "password": "password123"
}

Response: {
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-uuid",
    "email": "sales1@meridukaan.com",
    "role": "SALES",
    "storeId": "store-uuid"
  }
}

// Step 2: Use token in subsequent requests
GET /pos/invoices/:id
Headers: {
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

## 👤 User Registration Flow

### Complete Signup Flow

```
┌─────────────────────────────────────────────────────────────┐
│                  USER REGISTRATION FLOW                      │
└─────────────────────────────────────────────────────────────┘

1. Get Available Stores (Public API)
   │
   └─→ GET /stores
       └─ Response: [ { id, name, region, city }, ... ]

2. User selects a store (if SALES role)
   │
   └─→ Copy store.id from response

3. Create New User Account
   │
   └─→ POST /auth/signup
       ├─ Request Body:
       │   {
       │     "email": "newsales@meridukaan.com",
       │     "password": "securePassword123",
       │     "role": "SALES",  // or ADMIN, INVENTORY, PURCHASE
       │     "storeId": "store-uuid"  // Required for SALES role
       │   }
       │
       └─ Response: {
           "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
           "user": {
             "id": "new-user-uuid",
             "email": "newsales@meridukaan.com",
             "role": "SALES",
             "storeId": "store-uuid"
           }
         }

4. User is automatically logged in (receives token)
   │
   └─→ Can immediately use protected APIs with the token
```

### Role-Specific Requirements

| Role | storeId Required? | Notes |
|------|------------------|-------|
| **ADMIN** | ❌ No | Can be null or assigned later |
| **SALES** | ✅ Yes | **Must** provide valid storeId |
| **INVENTORY** | ❌ No | Can be null or assigned later |
| **PURCHASE** | ❌ No | Can be null or assigned later |

### Error Scenarios

```
POST /auth/signup
Body: { "email": "existing@meridukaan.com", ... }

→ 409 Conflict: "User with this email already exists"

POST /auth/signup
Body: { "role": "SALES", "storeId": null }

→ 400 Bad Request: "Store ID is required for SALES role"

POST /auth/signup
Body: { "role": "SALES", "storeId": "invalid-uuid" }

→ 400 Bad Request: "Store not found"
```

---

## 🛒 POS (Point of Sale) Flow

### Complete POS Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                    POS WORKFLOW FLOW                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ STEP 1: Authenticate Sales User                              │
└─────────────────────────────────────────────────────────────┘
   │
   └─→ POST /auth/login
       └─→ Get access_token

┌─────────────────────────────────────────────────────────────┐
│ STEP 2: Scan Products (Repeat for each product)              │
└─────────────────────────────────────────────────────────────┘
   │
   └─→ POST /pos/scan
       ├─ Headers: Authorization: Bearer <token>
       ├─ Body: { "qrValue": "COKE-330ML" }
       │
       └─→ Response: {
             "product": {
               "id": "product-uuid",
               "sku": "COKE-330ML",
               "name": "Coca-Cola 330ml",
               "unitPrice": "35.00",
               "category": "Soft Drinks",
               "brand": "Coca-Cola",
               "manufacturer": "Coca-Cola Company"
             },
             "stockQty": 150
           }
       
       └─→ Save product.id and qty for invoice

┌─────────────────────────────────────────────────────────────┐
│ STEP 3: Create Invoice                                       │
└─────────────────────────────────────────────────────────────┘
   │
   └─→ POST /pos/invoices
       ├─ Headers: 
       │   Authorization: Bearer <token>
       │   idempotency-key: unique-key-123 (optional)
       ├─ Body: {
             "items": [
               {
                 "productId": "product-uuid-1",  // From scan
                 "qty": 5
               },
               {
                 "productId": "product-uuid-2",  // From scan
                 "qty": 3
               }
             ],
             "clientInvoiceRef": "INV-2026-001"  // Optional
           }
       │
       └─→ Response: {
             "invoiceId": "invoice-uuid",
             "pdfUrl": "/storage/invoices/invoice-uuid.pdf",
             "totals": {
               "amount": "175.00",
               "items": 5
             },
             "createdAt": "2026-01-15T17:00:00.000Z"
           }

┌─────────────────────────────────────────────────────────────┐
│ STEP 4: View Invoice Details (Optional)                      │
└─────────────────────────────────────────────────────────────┘
   │
   └─→ GET /pos/invoices/:id
       ├─ Headers: Authorization: Bearer <token>
       │
       └─→ Response: {
             "id": "invoice-uuid",
             "storeId": "store-uuid",  // Auto-set from user
             "workerId": "user-uuid",   // Auto-set from user
             "totalAmount": "175.00",
             "totalItems": 5,
             "status": "COMPLETED",
             "items": [ ... ],
             "store": { ... }
           }

┌─────────────────────────────────────────────────────────────┐
│ STEP 5: Download Invoice PDF (Optional)                      │
└─────────────────────────────────────────────────────────────┘
   │
   └─→ GET /pos/invoices/:id/pdf
       ├─ Headers: Authorization: Bearer <token>
       │
       └─→ Response: PDF file download
```

### Automatic Field Assignment

| Field | Source | Notes |
|-------|--------|-------|
| `storeId` | User's assigned store | SALES users: Always from `user.storeId`<br>ADMIN users: Can specify or use assigned store |
| `workerId` | Current user ID | Always set to authenticated user's ID |

### Important Notes

1. **Stock Validation**: System automatically checks stock availability before creating invoice
2. **Inventory Update**: Stock is automatically decremented when invoice is created
3. **PDF Generation**: PDF is generated asynchronously (may be null initially)
4. **Idempotency**: Use `idempotency-key` header to prevent duplicate invoices
5. **Role Restrictions**: 
   - SALES users can only create invoices for their assigned store
   - ADMIN users can specify any store

---

## 👥 User Management Flow (Admin)

### Admin User Management Workflow

```
┌─────────────────────────────────────────────────────────────┐
│              ADMIN USER MANAGEMENT FLOW                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ STEP 1: Admin Login                                          │
└─────────────────────────────────────────────────────────────┘
   │
   └─→ POST /auth/login
       ├─ Body: { "email": "admin@meridukaan.com", "password": "password123" }
       └─→ Get admin access_token

┌─────────────────────────────────────────────────────────────┐
│ STEP 2: List All Users                                       │
└─────────────────────────────────────────────────────────────┘
   │
   └─→ GET /users
       ├─ Headers: Authorization: Bearer <admin-token>
       │
       └─→ Response: [
             {
               "id": "user-uuid-1",
               "email": "admin@meridukaan.com",
               "role": "ADMIN",
               "storeId": null,
               "store": null
             },
             {
               "id": "user-uuid-2",
               "email": "sales1@meridukaan.com",
               "role": "SALES",
               "storeId": "store-uuid",
               "store": {
                 "id": "store-uuid",
                 "name": "Store Karachi Central",
                 "city": "Karachi",
                 "region": "Sindh"
               }
             },
             ...
           ]

┌─────────────────────────────────────────────────────────────┐
│ STEP 3: View Specific User (Optional)                         │
└─────────────────────────────────────────────────────────────┘
   │
   └─→ GET /users/:id
       ├─ Headers: Authorization: Bearer <admin-token>
       │
       └─→ Response: {
             "id": "user-uuid",
             "email": "sales1@meridukaan.com",
             "role": "SALES",
             "storeId": "store-uuid",
             "store": { ... }
           }

┌─────────────────────────────────────────────────────────────┐
│ STEP 4: Update User (Optional)                               │
└─────────────────────────────────────────────────────────────┘
   │
   └─→ PUT /users/:id
       ├─ Headers: Authorization: Bearer <admin-token>
       ├─ Body: {
             "email": "updated@meridukaan.com",  // Optional
             "password": "newPassword123",        // Optional
             "role": "SALES",                    // Optional
             "storeId": "store-uuid"             // Optional
           }
       │
       └─→ Response: Updated user object

┌─────────────────────────────────────────────────────────────┐
│ STEP 5: Delete User (Optional)                               │
└─────────────────────────────────────────────────────────────┘
   │
   └─→ DELETE /users/:id
       ├─ Headers: Authorization: Bearer <admin-token>
       │
       └─→ Response: {
             "message": "User with ID xxx has been deleted successfully",
             "deletedUser": {
               "id": "user-uuid",
               "email": "deleted@meridukaan.com"
             }
           }
```

### Update User Rules

| Field | Validation Rules |
|-------|------------------|
| `email` | Must be unique (if changed) |
| `password` | Will be hashed automatically |
| `role` | Must be valid enum value |
| `storeId` | Required if role is SALES |

---

## 📊 Admin Analytics Flow

### Analytics Dashboard Flow

```
┌─────────────────────────────────────────────────────────────┐
│                  ADMIN ANALYTICS FLOW                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ STEP 1: Admin Login                                          │
└─────────────────────────────────────────────────────────────┘
   │
   └─→ POST /auth/login (as admin)

┌─────────────────────────────────────────────────────────────┐
│ STEP 2: Get Filter Options                                   │
└─────────────────────────────────────────────────────────────┘
   │
   └─→ GET /admin/filters
       ├─ Headers: Authorization: Bearer <admin-token>
       │
       └─→ Response: {
             "regions": ["Sindh", "Punjab", ...],
             "cities": ["Karachi", "Lahore", ...],
             "stores": [ { id, name, region, city }, ... ],
             "categories": [ { id, name, parentId }, ... ],
             "manufacturers": [ { id, name }, ... ],
             "brands": [ { id, name, manufacturerId, manufacturerName }, ... ]
           }

┌─────────────────────────────────────────────────────────────┐
│ STEP 3: Get Summary Metrics                                 │
└─────────────────────────────────────────────────────────────┘
   │
   └─→ GET /admin/analytics/summary
       ├─ Headers: Authorization: Bearer <admin-token>
       ├─ Query Params (all optional):
       │   ?from=2026-01-01
       │   &to=2026-01-31
       │   &storeId=store-uuid
       │   &region=Sindh
       │   &city=Karachi
       │   &categoryId=category-uuid
       │   &manufacturerId=manufacturer-uuid
       │   &brandId=brand-uuid
       │
       └─→ Response: {
             "salesValue": "1000.00",
             "salesVolume": 200,
             "distribution": 75.5,
             "weightedDistribution": 80.2,
             "shareInShops": 65.3,
             "avgPricePerLitre": "45.50",
             "avgPricePerSKU": "5.00"
           }

┌─────────────────────────────────────────────────────────────┐
│ STEP 4: Get Additional Analytics (Optional)                  │
└─────────────────────────────────────────────────────────────┘
   │
   ├─→ GET /admin/analytics/sales-trend?from=...&to=...
   ├─→ GET /admin/analytics/brand-distribution?brandId=...
   ├─→ GET /admin/analytics/market-share?region=...
   ├─→ GET /admin/analytics/brands?categoryId=...
   └─→ GET /admin/analytics/top-skus?storeId=...
```

### Analytics Endpoints Overview

| Endpoint | Purpose | Key Filters |
|----------|---------|-------------|
| `/admin/filters` | Get all available filter options | None |
| `/admin/analytics/summary` | Overall metrics (sales, volume, distribution) | All filters supported |
| `/admin/analytics/sales-trend` | Sales trends over time | Date range, store, region, city |
| `/admin/analytics/brand-distribution` | Brand performance | Brand, category, manufacturer |
| `/admin/analytics/market-share` | Market share analysis | Region, city, brand |
| `/admin/analytics/brands` | Brand analytics | Category, manufacturer |
| `/admin/analytics/top-skus` | Top selling products | Store, region, city |

---

## 🔄 Complete Workflow Examples

### Example 1: New Sales User → Create Invoice

```
1. GET /stores
   → Get list of stores
   → Select store: "Store Karachi Central" (id: store-uuid-1)

2. POST /auth/signup
   Body: {
     "email": "newsales@meridukaan.com",
     "password": "password123",
     "role": "SALES",
     "storeId": "store-uuid-1"
   }
   → Get token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

3. POST /pos/scan
   Headers: Authorization: Bearer <token>
   Body: { "qrValue": "COKE-330ML" }
   → Get product: { id: "product-uuid-1", unitPrice: "35.00", stockQty: 150 }

4. POST /pos/scan
   Headers: Authorization: Bearer <token>
   Body: { "qrValue": "PEPSI-500ML" }
   → Get product: { id: "product-uuid-2", unitPrice: "50.00", stockQty: 100 }

5. POST /pos/invoices
   Headers: 
     Authorization: Bearer <token>
     idempotency-key: invoice-2026-001
   Body: {
     "items": [
       { "productId": "product-uuid-1", "qty": 5 },
       { "productId": "product-uuid-2", "qty": 3 }
     ],
     "clientInvoiceRef": "INV-2026-001"
   }
   → Invoice created: { invoiceId: "invoice-uuid", totals: { amount: "325.00", items: 8 } }

6. GET /pos/invoices/:invoice-uuid
   Headers: Authorization: Bearer <token>
   → View full invoice details

7. GET /pos/invoices/:invoice-uuid/pdf
   Headers: Authorization: Bearer <token>
   → Download PDF
```

### Example 2: Admin Managing Users

```
1. POST /auth/login
   Body: { "email": "admin@meridukaan.com", "password": "password123" }
   → Get admin token

2. GET /users
   Headers: Authorization: Bearer <admin-token>
   → List all users

3. GET /users/:user-id
   Headers: Authorization: Bearer <admin-token>
   → View specific user details

4. PUT /users/:user-id
   Headers: Authorization: Bearer <admin-token>
   Body: {
     "role": "SALES",
     "storeId": "store-uuid-2"
   }
   → Update user's role and store assignment

5. GET /users
   Headers: Authorization: Bearer <admin-token>
   → Verify changes
```

### Example 3: Admin Viewing Analytics

```
1. POST /auth/login (as admin)
   → Get admin token

2. GET /admin/filters
   Headers: Authorization: Bearer <admin-token>
   → Get all filter options

3. GET /admin/analytics/summary?from=2026-01-01&to=2026-01-31&region=Sindh
   Headers: Authorization: Bearer <admin-token>
   → Get summary for Sindh region in January 2026

4. GET /admin/analytics/top-skus?storeId=store-uuid-1
   Headers: Authorization: Bearer <admin-token>
   → Get top selling products for specific store

5. GET /admin/analytics/brand-distribution?brandId=brand-uuid
   Headers: Authorization: Bearer <admin-token>
   → Get distribution metrics for specific brand
```

---

## 🔑 Key Concepts

### Authentication & Authorization

- **Public APIs**: No token needed (`/stores`, `/auth/login`, `/auth/signup`)
- **Protected APIs**: Require `Authorization: Bearer <token>` header
- **Role-Based Access**: Different roles have different permissions
  - **ADMIN**: Full access to all endpoints
  - **SALES**: Can create invoices, scan products (only for assigned store)
  - **INVENTORY**: Can view invoices and PDFs
  - **PURCHASE**: Limited access (can view invoices)

### Automatic Field Assignment

- **storeId**: Automatically set from user's assigned store (SALES) or can be specified (ADMIN)
- **workerId**: Always set to authenticated user's ID
- **Password**: Automatically hashed before storage

### Error Handling

- **401 Unauthorized**: Missing or invalid token → Re-login
- **403 Forbidden**: Wrong role → Use correct user account
- **400 Bad Request**: Invalid input → Check request body
- **404 Not Found**: Resource doesn't exist → Check IDs
- **409 Conflict**: Duplicate email → Use different email

---

## 📝 Quick Reference

### API Call Order

1. **First Time User**: `GET /stores` → `POST /auth/signup` → Use APIs
2. **Existing User**: `POST /auth/login` → Use APIs
3. **POS Flow**: Login → Scan Products → Create Invoice → View Invoice → Download PDF
4. **Admin Flow**: Login → Get Filters → View Analytics → Manage Users

### Token Usage

- Token expires after 1 hour (default)
- Store token securely
- Include in `Authorization` header: `Bearer <token>`
- Re-login if token expires

---

## ✅ Implementation Status

| Feature | Status | Endpoints |
|---------|--------|-----------|
| **Authentication** | ✅ Complete | `/auth/login`, `/auth/signup` |
| **User Management** | ✅ Complete | `/users` (GET, PUT, DELETE) |
| **Store Listing** | ✅ Complete | `/stores` (GET) |
| **POS Operations** | ✅ Complete | `/pos/scan`, `/pos/invoices` |
| **Invoice Management** | ✅ Complete | `/pos/invoices/:id`, `/pos/invoices/:id/pdf` |
| **Admin Analytics** | ✅ Complete | `/admin/filters`, `/admin/analytics/*` |
| **WebSocket** | ✅ Implemented | Real-time updates (invoice created, inventory updated) |

---

**Last Updated**: Based on current codebase implementation  
**All endpoints verified and tested**
