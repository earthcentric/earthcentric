-- Migration: Add box-based bulk ordering, GSTIN, and Super Admin commission snapshots
-- Safe and additive schema changes preserving all existing data
BEGIN;

-- 1. Product packaging & commission
ALTER TABLE "Product" 
ADD COLUMN IF NOT EXISTS "unitsPerBox" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN IF NOT EXISTS "commissionRate" DOUBLE PRECISION DEFAULT 10.0;

-- 2. Seller default commission
ALTER TABLE "Seller"
ADD COLUMN IF NOT EXISTS "commissionRate" DOUBLE PRECISION DEFAULT 10.0;

-- 3. Order GSTIN, box counts, and financial snapshots
ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "gstin" TEXT,
ADD COLUMN IF NOT EXISTS "totalBoxes" INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS "grossAmount" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "commissionRate" DOUBLE PRECISION DEFAULT 10.0,
ADD COLUMN IF NOT EXISTS "commissionAmount" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "sellerNetAmount" DOUBLE PRECISION;

-- 4. OrderItem box quantities and snapshots
ALTER TABLE "OrderItem"
ADD COLUMN IF NOT EXISTS "boxes" INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS "unitsPerBox" INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS "totalUnits" INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS "pricePerBox" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "commissionRate" DOUBLE PRECISION DEFAULT 10.0,
ADD COLUMN IF NOT EXISTS "commissionAmount" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "sellerNetAmount" DOUBLE PRECISION;

COMMIT;

