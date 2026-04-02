# 🔐 Auth Infrastructure Audit

**Audit Date:** 2026-04-02  
**Version:** 0.1.5  
**Status:** ⚠️ **PARTIAL - Critical Gaps**

---

## 📋 Executive Summary

The auth infrastructure uses **Better Auth** with Drizzle adapter. The core flow works but has **significant gaps** in UI, email templates, and brand integration.

**Key Findings:**
- ✅ Better Auth provider configured correctly
- ✅ Session management works
- ✅ Viewer loader with caching
- ❌ **NO auth pages generated** (login, signup, etc.)
- ❌ Email templates not branded
- ❌ No org redirect after signup
- ❌ Missing auth schema file

---

## 🎯 PRD Claims vs Reality

### PRD Claims (from README.md)

> "Auth + orgs are always included"
> "Better Auth (text IDs), Drizzle ORM (Postgres)"
> "Auth pages: `/login`, `/get-started`, `/forgot-password`, `/reset-password`"

### Reality Check

| Claim | Status | Evidence |
|-------|--------|----------|
| Better Auth configured | ✅ Yes | `lib/auth/auth.ts` generated |
| Auth pages exist | ❌ **NO** | No pages in `auth-core.module.ts` |
| Email templates | ⚠️ Basic | Generic black theme, not branded |
| Viewer context | ✅ Yes | `loadViewer()` in layout |
| Sign out action | ✅ Yes | `signOutAction()` generated |
| Org redirect | ❌ **NO** | No redirect logic after signup |

---

## 🏗️ Architecture Analysis

### Current Flow

```
┌─────────────┐
│   User      │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────┐
│  /login (MISSING - user must   │
│          create manually)       │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  Better Auth Handler            │
│  /api/auth/[...all]/route.ts   │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  Drizzle Adapter → Postgres     │
│  - user table                   │
│  - session table                │
│  - account table                │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  viewer.service.ts              │
│  - getSession()                 │
│  - ensureProfile()              │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  loadViewer() (cached)          │
│  - Used in SiteHeader           │
└─────────────────────────────────┘
```

### What's Generated (auth-core.module.ts)

| File | Status | Purpose |
|------|--------|---------|
| `lib/auth/auth.ts` | ✅ | Better Auth instance |
| `lib/services/viewer.service.ts` | ✅ | Get current user |
| `lib/services/auth.service.ts` | ✅ | Sign out logic |
| `lib/loaders/viewer.loader.ts` | ✅ | Cached viewer |
| `lib/actions/auth.actions.ts` | ✅ | Server action for signout |
| `lib/hooks/client/use-viewer.ts` | ✅ | TanStack Query hook |
| `lib/query-keys/auth.keys.ts` | ✅ | Cache keys |
| `lib/mutation-keys/auth.keys.ts` | ✅ | Mutation keys |
| `app/api/v1/auth/viewer/route.ts` | ✅ | API endpoint |
| `app/api/v1/auth/signout/route.ts` | ✅ | Sign out endpoint |
| `app/login/page.tsx` | ❌ **MISSING** | Login page |
| `app/get-started/page.tsx` | ❌ **MISSING** | Signup page |
| `app/forgot-password/page.tsx` | ❌ **MISSING** | Password reset request |
| `app/reset-password/page.tsx` | ❌ **MISSING** | Set new password |
| `lib/auth/auth-schema.ts` | ❌ **MISSING** | Auth schema types |

---

## 📧 Email Integration Audit

### Current State (email-resend.module.ts)

| Feature | Status | Notes |
|---------|--------|-------|
| Resend client | ✅ | `lib/email/resend.ts` |
| Verify email template | ✅ | `templates/verify-email.tsx` |
| Reset password template | ✅ | `templates/reset-password.tsx` |
| Auth integration | ✅ | Patched into `auth.ts` |
| Brand colors | ❌ | Generic black theme |
| App name | ⚠️ | Uses `NEXT_PUBLIC_APP_NAME` |
| Theme colors | ❌ | Not using globals.css tokens |

### Email Template Quality

**Current Design:**
```tsx
const base = {
  bg: "#0a0a0a",        // ← Hardcoded black
  panel: "#0f0f0f",
  border: "#262626",
  text: "#fafafa",
  muted: "#a3a3a3",
  subtle: "#737373",
  brand: "#ffffff",      // ← White button
  brandText: "#000000",
};
```

**Should Be:**
```tsx
// Use theme colors from config
const theme = {
  bg: themeColors.background,
  brand: themeColors.primary,
  brandText: themeColors.primaryForeground,
  // ...etc
};
```

### Email Flow

```
User signs up
    ↓
Better Auth triggers emailVerification
    ↓
sendVerifyEmail() called
    ↓
Resend sends email
    ↓
User clicks link
    ↓
Better Auth verifies
    ↓
User signed in
    ↓
❌ NO REDIRECT TO ORG PAGE (user lands on homepage)
```

**Missing:** Post-verification redirect to `/app/orgs`

---

## 🎨 UI/UX Audit

### What Users See Today

**After `npx 0xstack init`:**
```
❌ No /login page
❌ No /get-started page
❌ No sign in button in header (just placeholder text)
❌ No auth flow
```

**User Must Manually:**
1. Create login page
2. Create signup page
3. Create forgot password page
4. Create reset password page
5. Wire up forms to Better Auth client
6. Add redirect logic
7. Handle errors
8. Add loading states

### What Should Happen

**After `npx 0xstack baseline`:**
```
✅ /login page with email/password form
✅ /get-started page with signup form
✅ /forgot-password page
✅ /reset-password page
✅ Header shows "Sign in" / "Get started" buttons
✅ After signup → redirect to /app/orgs
✅ Email verification sent with branded template
✅ After verification → redirect to /app/orgs
```

---

## 🔍 Better Auth Integration

### Provider Configuration

```typescript
// lib/auth/auth.ts
export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: {
    enabled: true,
    async sendResetPassword({ user, url }) {
      await sendResetPasswordEmail({...});
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    async sendVerificationEmail({ user, url }) {
      await sendVerifyEmail({...});
    },
  },
});
```

**Status:** ✅ Correctly configured

### Missing: Auth Schema

Better Auth generates schema via CLI:
```bash
npx auth@latest generate
```

**But this file is missing from doctor checks:**
- `lib/auth/auth-schema.ts`

---

## 🚪 Authentication Flow Gaps

### Gap 1: No Auth Pages

**Expected:**
```bash
npx 0xstack baseline
# Should generate:
# - app/login/page.tsx
# - app/get-started/page.tsx
# - app/forgot-password/page.tsx
# - app/reset-password/page.tsx
```

**Reality:**
```bash
# No pages generated - user must create manually
```

### Gap 2: No Org Redirect

**Expected:**
```typescript
// After signup or email verification
redirect("/app/orgs");
```

**Reality:**
```typescript
// No redirect logic
// User lands on homepage, confused
```

### Gap 3: No Brand Integration

**Expected:**
```tsx
// Email template uses app theme
<Shell theme={theme} appName={config.app.name}>
```

**Reality:**
```tsx
// Hardcoded black theme
const base = { bg: "#0a0a0a", ... };
```

---

## 📊 End-to-End Flow Test

### Can a user sign up and use the app today?

**Test Scenario:**
1. Run `npx 0xstack init`
2. Run `npx 0xstack baseline`
3. Visit `http://localhost:3000`
4. Click "Sign in"
5. Try to sign up

**Result:**

| Step | Expected | Actual | Pass? |
|------|----------|--------|-------|
| 1. Init | Creates project | ✅ Works | ✅ |
| 2. Baseline | Generates all files | ⚠️ Missing auth pages | ❌ |
| 3. Visit homepage | Shows app | ✅ Works | ✅ |
| 4. Click "Sign in" | Goes to /login | ❌ 404 | ❌ |
| 5. Sign up | Creates account | ❌ No page | ❌ |
| 6. Email verification | Sends email | ⚠️ Works if Resend configured | ✅ |
| 7. After verification | Redirect to /app/orgs | ❌ No redirect | ❌ |

**Verdict: ❌ AUTH FLOW NOT END-TO-END WORKING**

---

## 🔧 What's Needed to Fix

### Phase 1: Auth Pages (4-6 hours)

Create in `auth-core.module.ts`:

```typescript
// app/login/page.tsx
// app/get-started/page.tsx
// app/forgot-password/page.tsx
// app/reset-password/page.tsx
```

Each page needs:
- Form with validation
- Better Auth client integration
- Error handling
- Loading states
- Redirect logic

### Phase 2: Email Branding (2-3 hours)

Update email templates to:
- Read theme from config
- Use app colors
- Include app logo
- Add social links

### Phase 3: Redirect Logic (1 hour)

Add to Better Auth config:
```typescript
emailVerification: {
  sendOnSignUp: true,
  autoSignInAfterVerification: true,
  redirectTo: "/app/orgs",  // ← Add this
}
```

### Phase 4: Doctor Checks (1 hour)

Add to `run-doctor.ts`:
```typescript
await checkFiles("auth.pages", [
  "app/login/page.tsx",
  "app/get-started/page.tsx",
  "app/forgot-password/page.tsx",
  "app/reset-password/page.tsx",
]);
```

---

## 📋 Recommendations

### Critical (Must Fix Before "Production Ready" Claim)

1. **Add auth pages** - Users can't sign in without them
2. **Add org redirect** - Critical for multi-tenant flow
3. **Add doctor checks** - Detect missing auth files

### High Priority

4. **Brand email templates** - Professional appearance
5. **Add auth schema** - Type safety
6. **Add error boundaries** - Graceful failures

### Medium Priority

7. **Add social auth** - Google/GitHub providers
8. **Add 2FA** - TOTP support
9. **Add session management UI** - View/revoke sessions

---

## 🎯 Verdict

| Aspect | Score | Notes |
|--------|-------|-------|
| **Provider Setup** | ✅ 9/10 | Better Auth configured well |
| **Backend Services** | ✅ 8/10 | Viewer, actions, loaders work |
| **UI Pages** | ❌ 0/10 | **MISSING ENTIRELY** |
| **Email Integration** | ⚠️ 6/10 | Works but not branded |
| **Redirects** | ❌ 2/10 | No org redirect |
| **Type Safety** | ⚠️ 6/10 | Missing auth schema |
| **End-to-End Flow** | ❌ 3/10 | **NOT WORKING** |

**Overall: 4.9/10 - Backend works, UI missing, flow broken**

---

## 🔧 What Users Must Do Today

```bash
# After baseline, manually create:

# 1. Login page
cat > app/login/page.tsx << 'EOF'
// Must implement:
// - Email/password form
// - Better Auth signIn.email()
// - Error handling
// - Redirect to /app/orgs
EOF

# 2. Signup page
cat > app/get-started/page.tsx << 'EOF'
// Must implement:
// - Name/email/password form
// - Better Auth signUp.email()
// - Email verification flow
// - Redirect to /app/orgs
EOF

# 3. Wire up email
# Already done by baseline if email module enabled

# 4. Test flow
# Manual testing required
```

**Time Required:** 4-8 hours for experienced dev

---

## ✅ What "Done" Looks Like

```bash
npx 0xstack init
npx 0xstack baseline --profile core
pnpm dev

# Visit http://localhost:3000
# Click "Get started"
# Fill form → submit
# Check email → click verify link
# Redirected to /app/orgs
# Create org → start using app
```

**Today:** Steps 4-7 don't work.

---

**End of Audit**
