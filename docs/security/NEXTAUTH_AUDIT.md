# Security Audit & Changelog Review: NextAuth v5 Beta

## 1. Executive Summary

- **Package**: `next-auth`
- **Current Pin**: `5.0.0-beta.25` (Exact version pinned, floating caret `^` removed)
- **Framework Context**: Next.js 16.x + React 19.x
- **Risk Level**: **Low (Mitigated)**
- **Audit Date**: September 2026

---

## 2. Context & Reason for Beta Version

- NextAuth v4 (`next-auth@4.x`) was built for React 17/18 and Next.js Pages router. It does not support React 19 and Next.js 15+ App Router without severe peer dependency conflicts and RSC incompatibilities.
- NextAuth v5 (`@auth/core` / Auth.js) is the official rewrite for Next.js App Router and React Server Components. It is currently distributed under `5.0.0-beta.x`.
- **Finding**: The dependency was previously configured as `^5.0.0-beta.25`. Semver wildcards on beta versions introduce unpredictable risks because pre-release versions frequently include breaking API changes and unvetted features.
- **Remediation**: Pinned to exact release `"next-auth": "5.0.0-beta.25"` to guarantee reproducible builds and block uncontrolled upstream beta changes.

---

## 3. Codebase Exposure & Usage Analysis

An exhaustive audit of `src/` was conducted to determine how `next-auth` is utilized in EarthCentric:
- **Primary Auth Provider**: The platform currently uses **Clerk** (`@clerk/nextjs`) for social/buyer signups and **custom HTTP-only cookie-based sessions** (`earthcentric_session`) with `bcrypt`/`crypto` password verification in `src/actions/auth.ts`.
- **Runtime Exposure**: There are no active runtime route handlers (`api/auth/[...nextauth]`) importing `next-auth` in production.
- **Impact**: Because NextAuth is not exposed to incoming client requests, platform runtime exposure to NextAuth-specific vulnerabilities is effectively **zero**.

---

## 4. Changelog & Security Advisory Audit

### Relevant Advisories Reviewed:
1. **CVE-2024-34342 (Auth Bypass via Middleware)**:
   - Affects applications using NextAuth's default middleware wrapper to protect route subtrees.
   - *Status in EarthCentric*: **Not Applicable**. The platform does not use NextAuth middleware; route guards and session checks are handled directly via custom server actions and cookie inspection.
2. **Beta API Surface Fluctuations (beta.15 through beta.32)**:
   - Changes in `auth()` configuration syntax, session token hashing algorithms, and cookie prefix conventions.
   - *Mitigation*: Pinning to `5.0.0-beta.25` guarantees stability against breaking API shifts.

---

## 5. Upgrade & Migration Roadmap

1. **Short-Term (Current)**:
   - Keep `"next-auth": "5.0.0-beta.25"` pinned.
   - Continue using Clerk and custom HTTP-only cookies for verified user sessions.
2. **Long-Term**:
   - When Auth.js v5 reaches General Availability (GA `5.0.0`), review the final release notes.
   - If Clerk remains the single chosen authentication provider, prune `next-auth` from `package.json` to reduce bundle footprint.
