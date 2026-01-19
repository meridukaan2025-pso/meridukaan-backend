# Developer Notes - Authentication & User Management

## ✅ Implementation Complete

**Auth, Signup, CRUD, Swagger** - All implemented and tested.

## 🔑 Default Credentials (From Seed Data)

All users created by seed script use password: `password123`

### Admin User:
- **Email:** `admin@meridukaan.com`
- **Password:** `password123`
- **Role:** `ADMIN`
- **Store:** None (ADMIN doesn't require store)

### Sales Users:
- **Email:** `sales1@meridukaan.com`
- **Password:** `password123`
- **Role:** `SALES`
- **Store:** Store Karachi Central

- **Email:** `sales2@meridukaan.com`
- **Password:** `password123`
- **Role:** `SALES`
- **Store:** Store Lahore Main

### Other Users:
- **Email:** `inventory@meridukaan.com` (Role: INVENTORY)
- **Email:** `purchase@meridukaan.com` (Role: PURCHASE)

## 🔐 Authentication Flow

### Before Signup - Get Store ID

**IMPORTANT:** Before creating a user account, you must first call the stores API to get a valid store ID.

### Step-by-Step Flow:

1. **Get Stores** (Public - No auth required):
   ```bash
   GET /stores
   ```
   Returns list of available stores with their IDs.

2. **Signup** (Public):
   ```bash
   POST /auth/signup
   {
     "email": "user@example.com",
     "password": "password123",
     "role": "SALES",
     "storeId": "store-id-from-step-1"  // Required for SALES role
   }
   ```

3. **Login** (Public):
   ```bash
   POST /auth/login
   {
     "email": "user@example.com",
     "password": "password123"
   }
   ```

## 🏪 Why Store Association is Required

**Reason:** SALES users are permanently assigned to one store for security and operational control. This ensures sales staff can only process transactions at their designated location, preventing cross-store operations and maintaining proper inventory management. The store association is validated during signup and automatically used in all POS operations (scan, invoices) without requiring manual store selection.

## 📋 Available Endpoints

### Public Endpoints (No Auth):
- `GET /stores` - List all stores
- `POST /auth/login` - User login
- `POST /auth/signup` - User registration

### Protected Endpoints (Require JWT + Role):
- `GET /users` - List all users (ADMIN only)
- `GET /users/:id` - Get user by ID (ADMIN only)
- `PUT /users/:id` - Update user (ADMIN only)
- `DELETE /users/:id` - Delete user (ADMIN only)
- `POST /pos/scan` - Scan product (SALES/ADMIN)
- `POST /pos/invoices` - Create invoice (SALES/ADMIN)

## 🔒 Security Features

- SALES users are restricted to their assigned store only
- Store ID is automatically used in POS operations (no manual input needed)
- Worker ID is automatically set from authenticated user
- Duplicate email validation on signup and update
- Password hashing with bcrypt
- JWT-based authentication
- Role-based access control (RBAC)

## 📚 Swagger Documentation

All endpoints are documented in Swagger UI at `/api-docs` after deployment.
