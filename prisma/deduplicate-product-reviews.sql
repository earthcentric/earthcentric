-- Keep the earliest product review for each buyer/product pair and prevent duplicates.
-- Back up the production database before applying this transaction.
BEGIN;

WITH ranked_product_reviews AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "userId", "productId"
      ORDER BY "createdAt" ASC, "id" ASC
    ) AS row_number
  FROM "Review"
  WHERE "productId" IS NOT NULL
    AND "sellerId" IS NULL
)
DELETE FROM "Review" AS review
USING ranked_product_reviews AS ranked
WHERE review."id" = ranked."id"
  AND ranked.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "Review_userId_productId_product_review_key"
  ON "Review" ("userId", "productId")
  WHERE "productId" IS NOT NULL
    AND "sellerId" IS NULL;

COMMIT;
