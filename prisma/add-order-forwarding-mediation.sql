-- Add order forwarding and mediation fields to Order table
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "isForwardedToSeller" BOOLEAN DEFAULT false;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "forwardedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "forwardedByAdminEmail" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "assignedSellerId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "adminFulfillmentInstructions" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "fulfillmentDeadline" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "adminReviewStatus" TEXT DEFAULT 'PENDING_REVIEW';

