-- Step 1: Add store_id column as nullable first (TEXT to match stores.id)
ALTER TABLE "products" ADD COLUMN "store_id" TEXT;

-- Step 2: Assign all existing products to the first store
-- Get the first store ID and update all products
UPDATE "products" 
SET "store_id" = (SELECT id FROM "stores" ORDER BY "created_at" ASC LIMIT 1)
WHERE "store_id" IS NULL;

-- Step 3: Make store_id required (NOT NULL)
ALTER TABLE "products" ALTER COLUMN "store_id" SET NOT NULL;

-- Step 4: Add foreign key constraint
ALTER TABLE "products" ADD CONSTRAINT "products_store_id_fkey" 
FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 5: Drop old unique constraint on sku (if it exists)
ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_sku_key";

-- Step 6: Add new unique constraint on (sku, store_id)
ALTER TABLE "products" ADD CONSTRAINT "products_sku_store_id_key" UNIQUE ("sku", "store_id");
