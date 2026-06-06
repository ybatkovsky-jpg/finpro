# Task: Implement RBAC + JWT Authentication with NextAuth.js v4

## Summary

Implemented complete RBAC + JWT authentication system for the FinPro management accounting system using NextAuth.js v4.

## Files Created

1. **`/src/lib/auth.ts`** — NextAuth configuration with:
   - Credentials provider (email + password)
   - JWT strategy with role in token
   - Session callback including role
   - bcryptjs password verification
   - 24h JWT/session maxAge
   - Custom error messages in Russian

2. **`/src/types/next-auth.d.ts`** — TypeScript type augmentations for NextAuth User, Session, and JWT interfaces

3. **`/src/app/api/auth/[...nextauth]/route.ts`** — NextAuth API route handler (GET + POST)

4. **`/src/lib/auth-guard.ts`** — Authorization helpers:
   - `getCurrentUser()` — get user from session
   - `requireRole(...roles)` — enforce role requirements
   - `canAccessProject(userId, role, projectManagerId)` — project-level access check
   - `getRolePermissions(role)` — detailed permission map per role
   - `getProjectFilter()` / `getTransactionFilter()` — Prisma where clause builders for RLS

5. **`/src/components/auth/signin-form.tsx`** — Professional login form with Russian labels, demo credentials hint, error display

6. **`/src/components/auth/auth-provider.tsx`** — SessionProvider wrapper component

7. **`/src/app/api/auth/register/route.ts`** — Registration endpoint (owner only), with bcryptjs hashing and validation

## Files Modified

8. **`/src/app/layout.tsx`** — Wrapped children with AuthProvider

9. **`/src/app/page.tsx`** — Session check: shows SignInForm if unauthenticated, AppLayout if authenticated, loading spinner during session resolution

10. **`/src/components/layout/sidebar.tsx`** — Dynamic user info from session (name, initials, role), dropdown menu with logout button

11. **`.env`** — Added NEXTAUTH_SECRET and NEXTAUTH_URL

12. **`prisma/seed.ts`** — All passwords now hashed with bcryptjs (was plaintext before)

## Role Permissions

| Permission | owner | accountant | manager | storekeeper |
|---|---|---|---|---|
| Create users | ✅ | ❌ | ❌ | ❌ |
| Full project CRUD | ✅ | ✅ (no delete) | Own only | Read only |
| Full transaction CRUD | ✅ | ✅ | Own only | Read only |
| Import data | ✅ | ✅ | ❌ | ❌ |
| View reports | ✅ | ✅ | ✅ | ✅ |
| Manage categories/counterparties | ✅ | ✅ | ❌ | ❌ |

## Database

- Re-seeded with bcrypt-hashed passwords
- All 4 demo users work with password "password123"
- Seeding completed successfully (4 users, 5 clients, 6 counterparties, 12 categories, 5 projects, 33 transactions)

## Lint & Dev Server

- ESLint: clean (no errors)
- Dev server: running on port 3000, no errors
