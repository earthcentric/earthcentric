-- Additive schema change for seller cancellation review and Cashfree refunds.
-- Back up the production database and review the target before applying.
BEGIN;

CREATE TABLE "OrderCancellation" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "activeOrderId" TEXT,
    "requestedByUserId" TEXT NOT NULL,
    "requestedByEmail" TEXT NOT NULL,
    "requestedByRole" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "adminNote" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "reviewedByEmail" TEXT,
    "refundStatus" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
    "refundAmount" DOUBLE PRECISION,
    "cashfreeOrderId" TEXT,
    "cashfreeRefundId" TEXT,
    "cashfreeRefundReference" TEXT,
    "refundArn" TEXT,
    "refundError" TEXT,
    "refundAttempt" INTEGER NOT NULL DEFAULT 0,
    "refundUpdatedAt" TIMESTAMP(3),
    CONSTRAINT "OrderCancellation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OrderCancellation_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "Order"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "OrderCancellation_cashfreeRefundId_key"
  ON "OrderCancellation"("cashfreeRefundId");
CREATE UNIQUE INDEX "OrderCancellation_activeOrderId_key"
  ON "OrderCancellation"("activeOrderId");
CREATE INDEX "OrderCancellation_status_requestedAt_idx"
  ON "OrderCancellation"("status", "requestedAt");
CREATE INDEX "OrderCancellation_orderId_requestedAt_idx"
  ON "OrderCancellation"("orderId", "requestedAt");

COMMIT;
