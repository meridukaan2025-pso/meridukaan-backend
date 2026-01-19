# Frontend Integration Guide - Product Quick Create Flow

## 🎯 Overview

When a barcode scan fails (product not found), the API returns a structured error response that includes the SKU. This SKU can be automatically pre-filled in the quick-create form.

---

## 📋 Complete Flow with API Responses

### Step 1: Scan Barcode

**Request:**
```javascript
POST /pos/scan
Headers: {
  "Authorization": "Bearer <token>",
  "Content-Type": "application/json"
}
Body: {
  "qrValue": "UNKNOWN-123"
}
```

**Response if Product Found (200 OK):**
```json
{
  "product": {
    "id": "product-uuid",
    "sku": "COKE-330ML",
    "name": "Coca-Cola 330ml",
    "unitPrice": "35.00",
    ...
  },
  "stockQty": 150
}
```

**Response if Product NOT Found (404 Not Found):**
```json
{
  "statusCode": 404,
  "timestamp": "2026-01-15T17:00:00.000Z",
  "path": "/pos/scan",
  "method": "POST",
  "message": "Product with SKU UNKNOWN-123 not found",
  "sku": "UNKNOWN-123",                    // ← Pre-fill this!
  "suggestion": "Use POST /products/quick-create to add this product manually",
  "endpoint": "/products/quick-create"
}
```

---

### Step 2: Frontend Handles 404 Error

```javascript
async function scanProduct(qrValue) {
  try {
    const response = await fetch('/pos/scan', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ qrValue })
    });
    
    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        product: data.product,
        stockQty: data.stockQty
      };
    }
    
    // Handle 404 - Product not found
    if (response.status === 404) {
      const errorData = await response.json();
      return {
        success: false,
        notFound: true,
        sku: errorData.sku,              // ← Pre-filled SKU!
        suggestion: errorData.suggestion,
        endpoint: errorData.endpoint
      };
    }
    
    throw new Error('Scan failed');
  } catch (error) {
    throw error;
  }
}
```

---

### Step 3: Show Quick Create Form (SKU Pre-filled)

```javascript
function QuickCreateProductForm({ sku, onProductCreated }) {
  const [formData, setFormData] = useState({
    sku: sku,                    // ← Pre-filled from scan error!
    name: '',
    categoryName: '',
    brandName: '',
    manufacturerName: '',
    unitPrice: 0,
    unitSizeMl: null
  });

  return (
    <form onSubmit={handleSubmit}>
      {/* SKU Field - Pre-filled and Read-only */}
      <input
        type="text"
        value={formData.sku}
        readOnly
        disabled
        placeholder="SKU (from barcode scan)"
      />
      
      {/* Name Field */}
      <input
        type="text"
        value={formData.name}
        onChange={(e) => setFormData({...formData, name: e.target.value})}
        placeholder="Product Name"
        required
      />
      
      {/* Category Name */}
      <input
        type="text"
        value={formData.categoryName}
        onChange={(e) => setFormData({...formData, categoryName: e.target.value})}
        placeholder="Category (e.g., Soft Drinks)"
        required
      />
      
      {/* Brand Name */}
      <input
        type="text"
        value={formData.brandName}
        onChange={(e) => setFormData({...formData, brandName: e.target.value})}
        placeholder="Brand Name"
        required
      />
      
      {/* Manufacturer Name */}
      <input
        type="text"
        value={formData.manufacturerName}
        onChange={(e) => setFormData({...formData, manufacturerName: e.target.value})}
        placeholder="Manufacturer Name"
        required
      />
      
      {/* Unit Price */}
      <input
        type="number"
        value={formData.unitPrice}
        onChange={(e) => setFormData({...formData, unitPrice: parseFloat(e.target.value)})}
        placeholder="Price"
        min="0"
        step="0.01"
        required
      />
      
      {/* Unit Size (Optional) */}
      <input
        type="number"
        value={formData.unitSizeMl || ''}
        onChange={(e) => setFormData({...formData, unitSizeMl: e.target.value ? parseInt(e.target.value) : null})}
        placeholder="Size in ML (optional)"
        min="0"
      />
      
      <button type="submit">Create Product & Add to Invoice</button>
    </form>
  );
}
```

---

### Step 4: Create Product and Get Product ID

```javascript
async function quickCreateProduct(productData) {
  const response = await fetch('/products/quick-create', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(productData)
  });
  
  if (response.ok) {
    const product = await response.json();
    return {
      success: true,
      productId: product.id,        // ← Use this for invoice!
      product: product
    };
  }
  
  const error = await response.json();
  throw new Error(error.message || 'Failed to create product');
}
```

**Response (201 Created):**
```json
{
  "id": "product-uuid-123",         // ← Save this!
  "sku": "UNKNOWN-123",
  "name": "New Product Name",
  "unitPrice": "50.00",
  "unitSizeMl": 500,
  "category": {
    "id": "category-uuid",
    "name": "Soft Drinks"
  },
  "brand": {
    "id": "brand-uuid",
    "name": "New Brand"
  },
  "manufacturer": {
    "id": "manufacturer-uuid",
    "name": "New Manufacturer"
  }
}
```

---

### Step 5: Complete Flow Example

```javascript
// Complete POS Flow
async function handleBarcodeScan(qrValue) {
  // Step 1: Try to scan
  const scanResult = await scanProduct(qrValue);
  
  if (scanResult.success) {
    // Product exists - add directly to invoice
    addToInvoiceItems({
      productId: scanResult.product.id,
      qty: 1,
      unitPrice: scanResult.product.unitPrice,
      stockQty: scanResult.stockQty
    });
    return;
  }
  
  // Step 2: Product not found - show quick create form
  if (scanResult.notFound) {
    // Show modal/form with SKU pre-filled
    const productData = await showQuickCreateModal({
      preFilledSku: scanResult.sku  // ← SKU automatically pre-filled!
    });
    
    // Step 3: Create product
    const createResult = await quickCreateProduct(productData);
    
    // Step 4: Add to invoice with new product ID
    addToInvoiceItems({
      productId: createResult.productId,  // ← Use product ID from creation
      qty: 1,
      unitPrice: productData.unitPrice,
      stockQty: 0  // New product has 0 stock
    });
    
    // Step 5: Close modal and continue
    closeQuickCreateModal();
  }
}
```

---

## 🎨 UI/UX Flow

```
┌─────────────────────────────────────────────────────────┐
│  POS Screen - User scans barcode                        │
└─────────────────────────────────────────────────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │  POST /pos/scan       │
        └───────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                        │
    Product Found          Product Not Found
        │                        │
        ▼                        ▼
┌───────────────┐    ┌──────────────────────────┐
│ Add to Invoice│    │ Show Quick Create Modal   │
│ (product.id)  │    │ SKU: "UNKNOWN-123" ✅     │
└───────────────┘    │ (Pre-filled from scan)   │
                     └──────────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ User fills form:      │
                    │ - Name                │
                    │ - Category            │
                    │ - Brand               │
                    │ - Manufacturer        │
                    │ - Price               │
                    └───────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ POST /products/        │
                    │ quick-create           │
                    └───────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ Response: product.id   │
                    │ "product-uuid-123"    │
                    └───────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ Add to Invoice        │
                    │ (product.id)          │
                    └───────────────────────┘
```

---

## ✅ Key Points

1. **SKU Auto-Pre-filled**: When scan returns 404, `error.sku` contains the scanned barcode
2. **No Manual Entry**: User doesn't need to type SKU again
3. **Seamless Flow**: Product created → Product ID returned → Invoice updated
4. **Error Handling**: Clear error messages guide user to quick-create

---

## 📝 Example: React Component

```jsx
function POSScanComponent() {
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [preFilledSku, setPreFilledSku] = useState('');

  const handleScan = async (qrValue) => {
    try {
      const result = await scanProduct(qrValue);
      
      if (result.success) {
        // Product found - add to invoice
        addToInvoice(result.product.id, result.stockQty);
      } else if (result.notFound) {
        // Product not found - show quick create form
        setPreFilledSku(result.sku);  // ← Pre-fill SKU!
        setShowQuickCreate(true);
      }
    } catch (error) {
      showError(error.message);
    }
  };

  const handleQuickCreate = async (productData) => {
    try {
      const result = await quickCreateProduct(productData);
      
      // Add new product to invoice
      addToInvoice(result.productId, 0);
      
      // Close modal
      setShowQuickCreate(false);
      setPreFilledSku('');
      
      showSuccess('Product created and added to invoice!');
    } catch (error) {
      showError(error.message);
    }
  };

  return (
    <div>
      {/* Scan Input */}
      <BarcodeScanner onScan={handleScan} />
      
      {/* Invoice Items */}
      <InvoiceItemsList items={invoiceItems} />
      
      {/* Quick Create Modal */}
      {showQuickCreate && (
        <QuickCreateModal
          preFilledSku={preFilledSku}  // ← SKU pre-filled!
          onSubmit={handleQuickCreate}
          onClose={() => setShowQuickCreate(false)}
        />
      )}
    </div>
  );
}
```

---

**Summary**: Haan, SKU automatically pre-filled hoga jab barcode scan fail hoga! 🎯
