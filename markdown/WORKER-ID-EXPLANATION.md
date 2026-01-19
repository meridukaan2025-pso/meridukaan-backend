# Worker ID Explanation - Kahan Se Aata Hai?

## 🎯 Short Answer

**Worker ID automatically aata hai authenticated user ki ID se!**  
Aapko manually pass karne ki zarurat nahi hai.

---

## 📋 Detailed Explanation

### 1. Worker ID Ka Source

```typescript
// src/pos/pos.controller.ts (Line 103-104)

// Worker ID is always the current user
const workerId = user.id;  // ← Yeh automatically set hota hai!
```

**Kahan se aata hai:**
- JWT token se authenticated user ki ID
- `@CurrentUser()` decorator se automatically extract hota hai
- User ko manually pass karne ki zarurat nahi

---

## 🔄 Complete Flow

### Step 1: User Login Karta Hai

```javascript
POST /auth/login
Body: {
  "email": "sales1@meridukaan.com",
  "password": "password123"
}

Response: {
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-uuid-123",  // ← Yeh workerId banega!
    "email": "sales1@meridukaan.com",
    "role": "SALES"
  }
}
```

### Step 2: Token Mein User ID Hoti Hai

JWT token decode karke:
```json
{
  "sub": "user-uuid-123",  // ← User ID (workerId)
  "email": "sales1@meridukaan.com",
  "role": "SALES",
  "storeId": "store-uuid"
}
```

### Step 3: Invoice Create Karte Waqt

```javascript
POST /pos/invoices
Headers: {
  "Authorization": "Bearer <token>"  // ← Token se user.id extract hota hai
}
Body: {
  "items": [
    {
      "productId": "product-uuid",
      "qty": 5
    }
  ]
  // ❌ workerId nahi dena - automatically set hoga!
}
```

### Step 4: Backend Automatically Set Karta Hai

```typescript
// Controller mein:
@CurrentUser() user: any  // ← Token se user extract hota hai

const workerId = user.id;  // ← Automatically set!
```

---

## ✅ Important Points

### 1. **Manual Pass Nahi Karna**
```javascript
// ❌ WRONG - Don't do this!
{
  "items": [...],
  "workerId": "some-id"  // ← Don't pass this!
}

// ✅ CORRECT - Just pass items
{
  "items": [
    {
      "productId": "product-uuid",
      "qty": 5
    }
  ]
}
```

### 2. **Automatic Assignment**
- Worker ID = Currently logged in user ki ID
- JWT token se automatically extract hota hai
- User ko manually specify karne ki zarurat nahi

### 3. **Security**
- User apni ID change nahi kar sakta
- Token se verify hota hai
- Only authenticated users hi invoice create kar sakte hain

---

## 🔍 Code Reference

### Controller (pos.controller.ts)

```typescript
@Post('invoices')
async createInvoice(
  @Body() createInvoiceDto: CreateInvoiceDto,
  @CurrentUser() user: any,  // ← User automatically extract hota hai
) {
  // Worker ID is always the current user
  const workerId = user.id;  // ← Yeh line workerId set karti hai!
  
  const invoiceData = {
    ...createInvoiceDto,
    storeId,
    workerId,  // ← Automatically added
  };
  
  return this.posService.createInvoice(invoiceData, idempotencyKey);
}
```

### Current User Decorator

```typescript
// src/auth/decorators/current-user.decorator.ts
// Yeh decorator JWT token se user extract karta hai
```

---

## 📝 Example: Complete Request

### Request (Frontend/Postman)

```javascript
POST /pos/invoices
Headers: {
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
Body: {
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

### Backend Processing

```typescript
// 1. Token se user extract
user = {
  id: "user-uuid-123",      // ← Worker ID yahan se aayega
  email: "sales1@meridukaan.com",
  role: "SALES",
  storeId: "store-uuid"
}

// 2. Worker ID set
workerId = user.id;  // "user-uuid-123"

// 3. Invoice create
invoiceData = {
  items: [...],
  clientInvoiceRef: "INV-2026-001",
  storeId: "store-uuid",      // Auto-set (SALES user)
  workerId: "user-uuid-123"   // Auto-set (current user)
}
```

---

## 🎯 Summary

| Field | Source | Manual Pass? |
|-------|--------|--------------|
| **workerId** | Authenticated user's ID (from JWT token) | ❌ No - Automatic |
| **storeId** | User's assigned store (SALES) or request body (ADMIN) | ⚠️ Optional (ADMIN only) |
| **productId** | From scan/create product | ✅ Yes - Required |
| **qty** | User input | ✅ Yes - Required |

---

## ✅ Conclusion

**Worker ID automatically aata hai:**
1. User login karta hai → Token milta hai
2. Token mein user ID hoti hai
3. Invoice create karte waqt token se user ID extract hoti hai
4. Wohi workerId ban jati hai

**Aapko kuch nahi karna - sab automatic hai!** 🎉
