-- Additive schema migration for Delivered Order Returns and Return Collection Tracking
BEGIN;

-- 1. Add deliveredAt to Order table if not present
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3);

-- 2. Add type and deliveredAt to OrderCancellation table
ALTER TABLE "OrderCancellation" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'CANCELLATION';
ALTER TABLE "OrderCancellation" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3);

-- 3. Create ReturnCollection table
CREATE TABLE IF NOT EXISTS "ReturnCollection" (
    "id" TEXT NOT NULL,
    "cancellationId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COLLECTION_PENDING',
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "collectionDeadline" TIMESTAMP(3) NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "collectedAt" TIMESTAMP(3),
    "inspectedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReturnCollection_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ReturnCollection_cancellationId_fkey"
      FOREIGN KEY ("cancellationId") REFERENCES "OrderCancellation"("id")
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReturnCollection_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "Order"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ReturnCollection_cancellationId_key"
  ON "ReturnCollection"("cancellationId");
CREATE INDEX IF NOT EXISTS "ReturnCollection_orderId_idx"
  ON "ReturnCollection"("orderId");
CREATE INDEX IF NOT EXISTS "ReturnCollection_status_idx"
  ON "ReturnCollection"("status");

COMMIT;
