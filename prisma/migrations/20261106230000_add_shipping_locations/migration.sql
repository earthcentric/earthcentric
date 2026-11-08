ALTER TABLE "Address"
ADD COLUMN "label" TEXT NOT NULL DEFAULT 'Home',
ADD COLUMN "landmark" TEXT,
ADD COLUMN "latitude" DOUBLE PRECISION,
ADD COLUMN "longitude" DOUBLE PRECISION,
ADD COLUMN "geocodingProvider" TEXT,
ADD COLUMN "providerLocationId" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Product"
ADD COLUMN "weightKg" DOUBLE PRECISION,
ADD COLUMN "lengthCm" DOUBLE PRECISION,
ADD COLUMN "widthCm" DOUBLE PRECISION,
ADD COLUMN "heightCm" DOUBLE PRECISION;

ALTER TABLE "Order"
ADD COLUMN "shippingFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "checkoutRequestId" TEXT;

CREATE TABLE "WarehouseLocation" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "landmark" TEXT,
    "postalCode" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'India',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "geocodingProvider" TEXT,
    "providerLocationId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseLocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShippingConfiguration" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ShippingConfiguration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderShipmentSnapshot" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "warehouseAddress" JSONB NOT NULL,
    "buyerAddress" JSONB NOT NULL,
    "warehousePin" TEXT NOT NULL,
    "buyerPin" TEXT NOT NULL,
    "shippingZone" TEXT NOT NULL,
    "routeDistanceKm" DOUBLE PRECISION,
    "routeDurationMinutes" DOUBLE PRECISION,
    "routeProvider" TEXT,
    "estimateStatus" TEXT NOT NULL,
    "actualCourierCost" DOUBLE PRECISION,
    "courierName" TEXT,
    "configurationVersion" INTEGER NOT NULL,
    "feeBreakdown" JSONB NOT NULL,
    "estimatedMinDays" INTEGER NOT NULL,
    "estimatedMaxDays" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderShipmentSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WarehouseLocation_sellerId_key" ON "WarehouseLocation"("sellerId");
CREATE UNIQUE INDEX "Order_userId_checkoutRequestId_sellerId_key" ON "Order"("userId", "checkoutRequestId", "sellerId");
CREATE UNIQUE INDEX "ShippingConfiguration_version_key" ON "ShippingConfiguration"("version");
CREATE INDEX "ShippingConfiguration_isActive_version_idx" ON "ShippingConfiguration"("isActive", "version");
CREATE UNIQUE INDEX "OrderShipmentSnapshot_orderId_key" ON "OrderShipmentSnapshot"("orderId");
CREATE INDEX "OrderShipmentSnapshot_sellerId_createdAt_idx" ON "OrderShipmentSnapshot"("sellerId", "createdAt");

ALTER TABLE "WarehouseLocation"
ADD CONSTRAINT "WarehouseLocation_sellerId_fkey"
FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrderShipmentSnapshot"
ADD CONSTRAINT "OrderShipmentSnapshot_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrderShipmentSnapshot"
ADD CONSTRAINT "OrderShipmentSnapshot_sellerId_fkey"
FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
