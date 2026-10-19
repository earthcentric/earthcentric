# Vercel account and database recovery

This guide covers the Clerk account-sync behavior and the production configuration required for the Vercel deployment.

## Required production configuration

Set these in Vercel under **Project → Settings → Environment Variables**, with the **Production** environment selected. Redeploy after changing variables.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Persistent production PostgreSQL connection string for the same database that contains the existing users and seller profiles. Do not use a mock URL or a preview database for production. |
| `SUPER_ADMIN_EMAILS` | Comma-separated, exact email allowlist for super-admin accounts, e.g. `rkearthcentric@gmail.com`. The existing exact `rkearthcentric@gmail.com` account is also recognized by the application. |
| `SELLER_EMAILS` | Optional comma-separated, exact seller-role recovery allowlist. Use only for accounts whose seller profile was lost; those users must complete seller verification again unless the database backup restores their profile. |
| `NEXT_PUBLIC_APP_URL` | Canonical deployed origin, e.g. `https://earthcentric-2ug9.vercel.app`; used to construct Cashfree's return URL. |
| `NEXTAUTH_URL` | Keep equal to the canonical deployed origin; the app also uses it for absolute URLs. |
| `SESSION_SECRET` | Random secret of at least 32 characters used to sign custom login sessions. `NEXTAUTH_SECRET` is accepted as a fallback. Do not reuse a password or commit this value. |
| `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY` | Production Cashfree credentials. Keep the secret server-only. |
| `CASHFREE_ENVIRONMENT` | `PRODUCTION` for live payments. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Matching Clerk **production** instance keys. |

Configure the Cashfree webhook to the stable URL:

`https://earthcentric-2ug9.vercel.app/api/webhooks/cashfree`

If the existing Vercel URL cannot be changed in Cashfree, retain it as the canonical Vercel domain. A Vercel deployment can change behind the same project domain; the URL only needs updating in Cashfree if the public origin itself changes. Verify Cashfree's registered return/notification URLs in the Cashfree dashboard.

The app returns the selected server Cashfree mode with the new payment session so the browser SDK uses the same `SANDBOX` or `PRODUCTION` environment. This avoids relying on a separately configured public environment variable.

Custom credential/Clerk role sessions are now HMAC-signed and expire after eight hours. Unsigned legacy `earthcentric_session` cookies are rejected; users must sign in again after deployment. Ensure `SESSION_SECRET` (or an existing strong `NEXTAUTH_SECRET`) is set in every Vercel environment before deploying this auth change.

For a Cashfree error saying `payment_session_id is not present or invalid`, check the latest Vercel **Function Logs** for the sanitized Cashfree API error. Confirm `CASHFREE_APP_ID` and `CASHFREE_SECRET_KEY` are a matching pair for the selected `CASHFREE_ENVIRONMENT`, and that the variables are set in the Production scope. Redeploy after changing them. A Cashfree API failure is now returned as an initialization error instead of being replaced with a fake session ID.

## Role behavior

- Clerk identity is matched to the application `User` row by normalized email.
- The server now verifies the signed-in Clerk user ID and verified primary email before syncing a database account; client-submitted role/email values cannot promote an account.
- Exact allowlisted super-admin email is synchronized as `ADMIN`.
- A linked Seller profile restores the `SELLER` role. `SELLER_EMAILS` can restore only the role when the Seller row is gone; it does not restore verification status, documents, products, or approval history.
- An existing seller profile restores the `SELLER` role even if the `User.role` value drifted. Existing non-seller roles are preserved; a client-provided role is not trusted during Clerk sync.
- Database sync errors no longer become a successful-looking, brand-new customer session. The application logs the underlying error and shows the user a retry/support message.

### Seller application approval visibility

Seller applications are stored as `Seller` records with `PENDING` verification status and should appear in the Super Admin dashboard's Seller Approvals view. The dashboard can be refreshed with **Refresh applications** after an application is submitted. In production, the seller list and status-update actions require a database-backed Super Admin identity; database read failures are reported instead of being replaced by mock seller data. If an application is missing, confirm the Production `DATABASE_URL`, check the Vercel function logs for seller-query errors, and verify the applicant's `Seller` row and `verificationStatus` in the intended database. Requesting more documents keeps the applicant's seller role so they can continue the verification process.

### Seller product approval

Seller-created products are saved with `isApproved=false` and `PENDING_APPROVAL`. The Super Admin dashboard's **Product Approvals** view reads these records and has **Refresh products** for applications submitted while the dashboard is open. Product approval and its audit/notification are committed together; rejection, audit, and the seller's notification (including the reason) are committed together. Only products with `isApproved=true` and status `APPROVED` are returned to the public marketplace. If a new listing is absent, check the Production `DATABASE_URL`, the product's database status, and Vercel logs; query failures are shown rather than replaced with mock products.

### Paid orders and verified seller customers

The Super Admin order list and payment transaction list show only `COMPLETED` payments; pending/abandoned checkouts are excluded. Seller customer profiles are grouped by database user ID, require a completed-payment order and verified email, and do not include demo customer records. Clerk sync verifies the primary email before recording `emailVerified` and stores the Clerk profile image only when one exists. No fallback customer avatar is displayed. No existing database records are deleted or merged by these display changes.

## Recovering the affected accounts

1. Confirm Production `DATABASE_URL` points to the intended persistent database. Check Vercel's deployment logs for Prisma errors such as missing tables/columns, authentication failures, or connection timeouts. Do not paste connection strings into chat or issue trackers.
2. If a recent database restore or migration removed users/sellers, restore the correct database backup first. A code push cannot recreate lost seller verification documents, products, or approval history.
3. With the application deployed, sign in once with the allowlisted super-admin Clerk account. The account sync creates/updates its database row as `ADMIN`.
4. For `bluegamer355@gmail.com`, if the original User and Seller rows still exist, sync should recover `SELLER` from its seller profile. If either row was lost, set Production `SELLER_EMAILS` to `bluegamer355@gmail.com`, then redeploy and sign in again; this restores the seller role but sends the account through verification. Restore seller data from backup where possible; the prior approved state and documents cannot be inferred from the email alone.
5. If repairing a role manually, first inspect the affected rows and database enum/table names. Back up the database, then update only the intended account. Do not run broad role updates.
6. Sign out of Clerk, clear the site's `earthcentric_user` local-storage entry or use a private window, and sign in again so the role is fetched from the database.

## Schema updates and deployments

`npm run build` generates the Prisma Client but does **not** apply database schema changes. This repository currently has no checked-in Prisma migrations. Before applying a schema change to production, take a database backup and review the diff. Use `npx prisma db push` only after confirming the target database and intended changes; do not add an unconditional production `db push` to the Vercel build command because schema changes can damage or conflict with live data.

For reliable future deployments, add and review Prisma migration files against a staging copy before running `prisma migrate deploy` in production.

### Cancellation and refund workflow

The seller/buyer cancellation review and Cashfree refund workflow adds the `OrderCancellation` table and indexes. Before deploying code that uses it:

1. Back up the intended production PostgreSQL database.
2. Review and apply `prisma/add-order-cancellations.sql` to that database as a single transaction.
3. Confirm the table and indexes exist before the updated application receives traffic.
4. Confirm the Cashfree webhook URL is `https://earthcentric-2ug9.vercel.app/api/webhooks/cashfree`, signature verification is configured, and the deployed `CASHFREE_ENVIRONMENT` matches the environment that captured the payment.

The SQL is additive; it does not alter existing order or payment rows. Do not run `prisma db push` or apply this script against a database until its target and backup are confirmed. A code build alone does not apply this schema.

Cancellation requests are allowed before shipment and require Super Admin review. An approved cancellation is distinct from a completed refund; only a confirmed Cashfree success changes the order to `REFUNDED`. Shipped/delivered orders require return/dispute handling instead. Dashboard role checks now verify the HMAC signature and load roles from the database. Other dashboard actions still require their own server-side permission review.

### Verified product reviews

Product reviews are shown only when that same buyer has a completed payment and a delivered order containing the reviewed product. Each buyer may submit one review per product. To remove existing duplicate product reviews and enforce this rule against concurrent submissions, back up the database and review `prisma/deduplicate-product-reviews.sql` before applying it. The script keeps the earliest review for each buyer/product pair and leaves seller-only reviews unchanged.

## Push-to-deploy expectations

When the Vercel project is connected to the GitHub repository, pushes to its configured production branch trigger Vercel deployments. GitHub pushes cannot repair missing Vercel environment variables, restore deleted database records, or change Cashfree dashboard configuration. Check the Vercel deployment status and logs after each push.
