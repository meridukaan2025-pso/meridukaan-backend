-- CreateEnum
CREATE TYPE "UnitSizeUnit" AS ENUM ('ML', 'L', 'G', 'KG', 'PCS');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "unit_size_unit" "UnitSizeUnit",
ADD COLUMN     "unit_size_value" DECIMAL(10,2);
