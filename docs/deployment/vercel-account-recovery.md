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
| `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY` | Production Cashfree credentials. Keep the secret server-only. |
| `CASHFREE_ENVIRONMENT` | `PRODUCTION` for live payments. |
| `NEXT_PUBLIC_CASHFREE_ENVIRONMENT` | `PRODUCTION` so the browser SDK uses the matching Cashfree environment. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Matching Clerk **production** instance keys. |

Configure the Cashfree webhook to the stable URL:

`https://earthcentric-2ug9.vercel.app/api/webhooks/cashfree`

If the existing Vercel URL cannot be changed in Cashfree, retain it as the canonical Vercel domain. A Vercel deployment can change behind the same project domain; the URL only needs updating in Cashfree if the public origin itself changes. Verify Cashfree's registered return/notification URLs in the Cashfree dashboard.

## Role behavior

- Clerk identity is matched to the application `User` row by normalized email.
- The server now verifies the signed-in Clerk user ID and verified primary email before syncing a database account; client-submitted role/email values cannot promote an account.
- Exact allowlisted super-admin email is synchronized as `ADMIN`.
- A linked Seller profile restores the `SELLER` role. `SELLER_EMAILS` can restore only the role when the Seller row is gone; it does not restore verification status, documents, products, or approval history.
- An existing seller profile restores the `SELLER` role even if the `User.role` value drifted. Existing non-seller roles are preserved; a client-provided role is not trusted during Clerk sync.
- Database sync errors no longer become a successful-looking, brand-new customer session. The application logs the underlying error and shows the user a retry/support message.

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

## Push-to-deploy expectations

When the Vercel project is connected to the GitHub repository, pushes to its configured production branch trigger Vercel deployments. GitHub pushes cannot repair missing Vercel environment variables, restore deleted database records, or change Cashfree dashboard configuration. Check the Vercel deployment status and logs after each push.
