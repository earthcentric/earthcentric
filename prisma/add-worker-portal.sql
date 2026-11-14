-- Additive schema changes for Customer Feedback Worker Portal
-- 1. Extend Role enum with WORKER
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'WORKER';

-- 2. CustomerFeedback table
CREATE TABLE IF NOT EXISTS "CustomerFeedback" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerType" TEXT NOT NULL,
    "callStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "feedbackNotes" TEXT,
    "workerNotes" TEXT,
    "nextFollowUpDate" TIMESTAMP(3),
    "lastContactedAt" TIMESTAMP(3),
    "workerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CustomerFeedback_customerId_idx" ON "CustomerFeedback"("customerId");
CREATE INDEX IF NOT EXISTS "CustomerFeedback_workerId_idx" ON "CustomerFeedback"("workerId");
CREATE INDEX IF NOT EXISTS "CustomerFeedback_customerType_callStatus_idx" ON "CustomerFeedback"("customerType", "callStatus");

-- 3. AbandonedCheckout table
CREATE TABLE IF NOT EXISTS "AbandonedCheckout" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cartSnapshot" JSONB NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "checkoutStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "checkoutRequestId" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "lastAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isAbandoned" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "feedbackCallStatus" TEXT,
    "feedbackNotes" TEXT,
    "abandonmentReason" TEXT,
    "workerId" TEXT,
    "lastWorkerContactAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AbandonedCheckout_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AbandonedCheckout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "AbandonedCheckout_checkoutRequestId_key" ON "AbandonedCheckout"("checkoutRequestId");
CREATE INDEX IF NOT EXISTS "AbandonedCheckout_userId_idx" ON "AbandonedCheckout"("userId");
CREATE INDEX IF NOT EXISTS "AbandonedCheckout_isAbandoned_paymentStatus_idx" ON "AbandonedCheckout"("isAbandoned", "paymentStatus");
CREATE INDEX IF NOT EXISTS "AbandonedCheckout_checkoutStartedAt_idx" ON "AbandonedCheckout"("checkoutStartedAt");
