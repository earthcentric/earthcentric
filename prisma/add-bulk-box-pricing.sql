-- Additive migration for box-based bulk pricing (twoBoxPrice, threePlusBoxPrice, etc.)
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "twoBoxPrice" DOUBLE PRECISION;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "threePlusBoxPrice" DOUBLE PRECISION;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "bulkPricingApproved" BOOLEAN DEFAULT true;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "minBulkBoxes" INTEGER DEFAULT 2;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "maxBulkBoxes" INTEGER;

-- Set default 1-box price to 2 and 100 units per box for existing products
UPDATE "Product" SET "price" = 2.0 WHERE "price" IS NULL OR "price" < 1.0;
UPDATE "Product" SET "unitsPerBox" = 100 WHERE "unitsPerBox" IS NULL OR "unitsPerBox" = 0;
UPDATE "Product" SET "twoBoxPrice" = 3.50 WHERE "twoBoxPrice" IS NULL;
UPDATE "Product" SET "threePlusBoxPrice" = 1.60 WHERE "threePlusBoxPrice" IS NULL;
UPDATE "Product" SET "bulkPricingApproved" = true WHERE "bulkPricingApproved" IS NULL;

