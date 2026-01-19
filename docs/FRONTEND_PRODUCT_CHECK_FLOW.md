# Frontend Product Check Flow - How FE Checks if Product Exists

## 🔍 How Frontend Checks if Product Exists in Backend

### **Method 1: POST /pos/scan (Recommended for POS)**

**When to use:** When user scans a barcode/QR code

**Request:**
```javascript
POST /pos/scan
Headers: {
  "Authorization": "Bearer <token>",
  "Content-Type": "application/json"
}
Body: {
  "qrValue": "COKE-330ML"  // or barcode number
}
```

**Response if Product EXISTS (200 OK):**
```json
{
  "product": {
    "id": "product-uuid",
    "sku": "COKE-330ML",
    "name": "Coca-Cola 330ml",
    "unitPrice": "35.00",
    ...
  },
  "stockQty": 150  // ← Stock available
}
```

**Response if Product NOT FOUND (404 Not Found):**
```json
{
  "statusCode": 404,
  "message": "Product with SKU COKE-330ML not found",
  "sku": "COKE-330ML",
  "suggestion": "Use POST /products/quick-create to add this product manually",
  "endpoint": "/products/quick-create"
}
```

**Frontend Code Example:**
```dart
// Flutter/Dart example
Future<Product?> scanProduct(String barcode) async {
  try {
    final response = await http.post(
      Uri.parse('$baseUrl/pos/scan'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({'qrValue': barcode}),
    );
    
    if (response.statusCode == 200) {
      // Product found!
      final data = jsonDecode(response.body);
      return Product.fromJson(data['product']);
    } else if (response.statusCode == 404) {
      // Product not found - show manual entry form
      final error = jsonDecode(response.body);
      showManualEntryForm(sku: error['sku']);
      return null;
    }
  } catch (e) {
    print('Error: $e');
  }
  return null;
}
```

---

### **Method 2: GET /products/sku/:sku**

**When to use:** To verify if a product exists by SKU before scanning

**Request:**
```javascript
GET /products/sku/COKE-330ML
Headers: {
  "Authorization": "Bearer <token>"
}
```

**Response if EXISTS (200 OK):**
```json
{
  "id": "product-uuid",
  "sku": "COKE-330ML",
  "name": "Coca-Cola 330ml",
  "unitPrice": "35.00",
  ...
}
```

**Response if NOT FOUND (404 Not Found):**
```json
{
  "statusCode": 404,
  "message": "Product not found"
}
```

**Frontend Code:**
```dart
Future<bool> checkProductExists(String sku) async {
  try {
    final response = await http.get(
      Uri.parse('$baseUrl/products/sku/$sku'),
      headers: {'Authorization': 'Bearer $token'},
    );
    return response.statusCode == 200;
  } catch (e) {
    return false;
  }
}
```

---

### **Method 3: GET /products (List All)**

**When to use:** To get all products and search locally

**Request:**
```javascript
GET /products
Headers: {
  "Authorization": "Bearer <token>"
}
```

**Response (200 OK):**
```json
[
  {
    "id": "product-uuid-1",
    "sku": "COKE-330ML",
    "name": "Coca-Cola 330ml",
    ...
  },
  {
    "id": "product-uuid-2",
    "sku": "PEPSI-330ML",
    "name": "Pepsi 330ml",
    ...
  }
]
```

**Frontend Code:**
```dart
Future<Product?> findProductById(String productId) async {
  final response = await http.get(
    Uri.parse('$baseUrl/products'),
    headers: {'Authorization': 'Bearer $token'},
  );
  
  if (response.statusCode == 200) {
    final products = (jsonDecode(response.body) as List)
        .map((p) => Product.fromJson(p))
        .toList();
    
    // Search locally
    return products.firstWhere(
      (p) => p.id == productId,
      orElse: () => null,
    );
  }
  return null;
}
```

---

## 🎯 Recommended Flow for Flutter App

### **Complete Product Check Flow:**

```dart
class ProductService {
  // Step 1: Scan barcode
  Future<ProductScanResult> scanBarcode(String barcode) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/pos/scan'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({'qrValue': barcode}),
      );
      
      if (response.statusCode == 200) {
        // ✅ Product found!
        final data = jsonDecode(response.body);
        return ProductScanResult(
          success: true,
          product: Product.fromJson(data['product']),
          stockQty: data['stockQty'],
        );
      } else if (response.statusCode == 404) {
        // ❌ Product not found
        final error = jsonDecode(response.body);
        return ProductScanResult(
          success: false,
          notFound: true,
          sku: error['sku'],
          message: error['message'],
        );
      }
    } catch (e) {
      return ProductScanResult(
        success: false,
        error: e.toString(),
      );
    }
    
    return ProductScanResult(success: false);
  }
  
  // Step 2: Check product by ID (before invoice creation)
  Future<bool> verifyProductExists(String productId) async {
    try {
      // Option A: Use scan endpoint with SKU (if you have SKU)
      // Option B: Get all products and search
      final response = await http.get(
        Uri.parse('$baseUrl/products'),
        headers: {'Authorization': 'Bearer $token'},
      );
      
      if (response.statusCode == 200) {
        final products = (jsonDecode(response.body) as List)
            .map((p) => Product.fromJson(p))
            .toList();
        
        return products.any((p) => p.id == productId);
      }
    } catch (e) {
      print('Error checking product: $e');
    }
    return false;
  }
}
```

---

## ⚠️ Common Issues & Solutions

### **Issue 1: Product ID Not Found**

**Error:** `"One or more products not found"`

**Causes:**
- Product ID doesn't exist in database
- Product was deleted
- Wrong product ID being used

**Solution:**
```dart
// Before creating invoice, verify product exists
final productExists = await productService.verifyProductExists(productId);
if (!productExists) {
  // Show error: Product not found
  // Option 1: Remove from cart
  // Option 2: Re-scan product
  // Option 3: Create product first
}
```

### **Issue 2: Product Exists but No Stock**

**Error:** `"Insufficient stock for product {sku}. Available: 0, Requested: 1"`

**Solution:**
```dart
// Check stock before adding to invoice
final scanResult = await productService.scanBarcode(barcode);
if (scanResult.success && scanResult.stockQty! < requestedQty) {
  // Show warning: Only X units available
  // Adjust quantity or skip product
}
```

---

## 📋 Best Practices

### **1. Always Verify Before Invoice Creation:**

```dart
Future<bool> validateInvoiceItems(List<InvoiceItem> items) async {
  for (final item in items) {
    // Check if product exists
    final exists = await verifyProductExists(item.productId);
    if (!exists) {
      showError('Product ${item.productId} not found');
      return false;
    }
    
    // Check stock (via scan)
    final stock = await getProductStock(item.productId);
    if (stock < item.qty) {
      showError('Insufficient stock');
      return false;
    }
  }
  return true;
}
```

### **2. Use Scan Endpoint for Real-time Checks:**

- ✅ Always use `/pos/scan` before adding to invoice
- ✅ It checks both product existence AND stock
- ✅ Returns latest product data

### **3. Handle Errors Gracefully:**

```dart
try {
  final result = await scanBarcode(barcode);
  if (result.notFound) {
    // Show manual entry form with SKU pre-filled
    showManualEntryForm(sku: result.sku);
  } else if (result.success) {
    // Add to invoice
    addToInvoice(result.product);
  }
} catch (e) {
  // Handle network errors, timeouts, etc.
  showError('Failed to scan product: $e');
}
```

---

## 🔄 Complete Flow Diagram

```
User Scans Barcode
    ↓
POST /pos/scan
    ↓
    ├─→ 200 OK: Product Found
    │   ├─→ Get product.id
    │   ├─→ Get stockQty
    │   └─→ Add to Invoice ✅
    │
    └─→ 404 Not Found: Product Missing
        ├─→ Show Manual Entry Form
        ├─→ Pre-fill SKU from error
        ├─→ User fills details
        ├─→ POST /products/quick-create
        ├─→ Get new product.id
        └─→ Add to Invoice ✅
```

---

## ✅ Summary

**Frontend checks product existence via:**

1. **POST /pos/scan** ← Best for POS (checks product + stock)
2. **GET /products/sku/:sku** ← Quick check by SKU
3. **GET /products** ← List all, search locally

**Before creating invoice:**
- ✅ Always verify product exists
- ✅ Check stock availability
- ✅ Handle errors gracefully

**If product not found:**
- Show manual entry form
- Use quick-create endpoint
- Continue invoice flow
