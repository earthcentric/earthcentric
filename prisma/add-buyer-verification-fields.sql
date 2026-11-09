-- Add buyer verification fields to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mobileNumber" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mobileNumberCountryCode" TEXT DEFAULT '+91';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mobileNumberSubmitted" BOOLEAN DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "buyerOnboardingCompleted" BOOLEAN DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "buyerVerifiedAt" TIMESTAMP(3);

-- Add lastSentAt field to OtpVerification table for resend cooldown tracking
ALTER TABLE "OtpVerification" ADD COLUMN IF NOT EXISTS "lastSentAt" TIMESTAMP(3);

-- Preserve existing verified buyers who already have phone and emailVerified
UPDATE "User"
SET "mobileNumber" = COALESCE("mobileNumber", "phone"),
    "mobileNumberSubmitted" = true,
    "buyerOnboardingCompleted" = true,
    "buyerVerifiedAt" = COALESCE("buyerVerifiedAt", "emailVerified", NOW())
WHERE "role" = 'BUYER' 
  AND "phone" IS NOT NULL 
  AND "emailVerified" IS NOT NULL 
  AND "buyerOnboardingCompleted" = false;

