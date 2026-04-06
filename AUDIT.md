# 0xstack CLI — Deep End-to-End Implementation Audit

**Date:** 2026-04-06  
**Scope:** `packages/cli/src/` — every command, module, template, wiring layer, dependency order, frontend design, hardcoded choices  
**Method:** Line-by-line code inspection of all 19 module files, 15 commands, init/baseline pipelines, and generated output templates

---

## Executive Summary

| Area | Status | Notes |
|------|--------|-------|
| **CLI commands** | ✅ Strong | 15+ commands, all functional |
| **Module generation** | ✅ Strong | 19 modules, ~120+ files generatable |
| **CQRS architecture** | ✅ Real | Full pipeline generated |
| **Auth (Better Auth)** | ✅ Real | Handler, pages, viewer, email wiring |
| **Orgs backbone** | ⚠️ Partial | `requireActiveOrg()` exists but not enforced everywhere |
| **Billing** | ⚠️ Partial | Infra real, UX incomplete |
| **Storage** | ⚠️ Partial | API real, upload UX missing |
| **Security** | ⚠️ Partial | Guards exist, not enforced everywhere |
| **Jobs** | ❌ Stub | Reconcile endpoint only |
| **Doctor** | ✅ Strong | 657 lines of checks |
| **Tests** | ❌ Zero | CLI has no tests |
| **Runbooks** | ❌ Missing | Zero documentation |
| **Hardcoded choices** | 🔴 Critical | Next.js, shadcn, themes, fonts, PM — all hardcoded |
| **Dependency order** | ⚠️ Fragile | Init → baseline → modules has ordering risks |
| **Frontend design** | ⚠️ Mixed | Some pages polished, others are stubs |
| **Missing components** | 🔴 Critical | Several pages reference components that don't exist |

---

## 1. Hardcoded Choices — Why Can't Users Choose?

### 1.1 Next.js Scaffolding — Zero User Choice

**File:** `core/init/run-init.ts` (lines 100-120)

```typescript
const args = [
  "dlx", "create-next-app@latest", createNextTargetFolder,
  "--ts", "--app", "--tailwind", "--eslint",
  "--no-src-dir", "--use-" + (input.packageManager === "npm" ? "npm" : "pnpm"),
  "--no-import-alias", "--yes", "--disable-git",
];
```

**Hardcoded:**
- ✅ TypeScript (no JS option)
- ✅ App Router (no Pages Router option)
- ✅ Tailwind CSS (no CSS Modules, no Styled Components)
- ✅ ESLint (no option to skip)
- ✅ No src directory (no `src/` layout option)
- ✅ No import alias customization
- ✅ No git init (separate command)

**User CAN choose:**
- Package manager (pnpm or npm — but NOT yarn or bun despite README claiming support)
- Theme (4 options: default, corporate-blue, amber, grass)
- Modules (via wizard)

**What's missing as options:**
- No `--src-dir` flag
- No `--no-tailwind` flag
- No `--no-eslint` flag
- No `--import-alias` flag
- No choice of CSS framework
- No choice of auth provider (Better Auth is fixed)
- No choice of ORM (Drizzle is fixed)
- No choice of DB (Postgres is fixed)

**Design rationale (inferred):** 0xstack is opinionated by design — it's not a menu-driven generator but a "production baseline" enforcer. However, the README claims "pnpm / yarn / bun" support while the code only implements pnpm/npm.

### 1.2 Shadcn/UI — Fully Automated, No User Control

**File:** `core/init/run-init.ts` (lines 168-180)

```typescript
await execCmd(dlxCmd, [...dlxArgs, "shadcn@latest", "init", "--defaults", "--yes", "--no-monorepo", "--cwd", projectRoot]);
await execCmd(dlxCmd, [...dlxArgs, "shadcn@latest", "add", "--yes", "--all", "--cwd", projectRoot]);
```

**Hardcoded:**
- `--defaults` — accepts all shadcn defaults (no user choice on style, color, radius)
- `--all` — installs ALL shadcn components (~50+ components) regardless of need
- No option to pick specific components
- No option to use a different UI library (Radix, MUI, Chakra)
- Theme is applied AFTER shadcn init by overwriting `globals.css`

**Problem:** `shadcn add --all` installs every component including sidebar, carousel, calendar, chart, etc. — most of which are never used. This bloats the bundle and creates dead code.

### 1.3 Theme System — 4 Hardcoded Themes

**File:** `core/init/globals-css.ts` (715 lines)

Four themes are hardcoded as CSS string literals:
1. `default` — black/white, Geist font
2. `corporate-blue` — purple primary, Inter + Merriweather + JetBrains Mono
3. `amber` — amber primary, Inter + Source Serif 4 + JetBrains Mono
4. `grass` — green primary, Outfit + serif + monospace

**What's missing:**
- No custom theme support
- No CSS variable override system
- No dark mode toggle option (always enabled)
- Font choices are baked into themes — no font selection

### 1.4 Package Manager — Only pnpm/npm

**File:** `core/init/run-init.ts`

```typescript
type PackageManager = "pnpm" | "npm";
```

README claims yarn/bun support but the type only allows pnpm/npm. The `modules` command and `deps` command also only support these two.

### 1.5 Auth Provider — Better Auth Only

**File:** `core/config.ts`

```typescript
auth: z.literal("better-auth").default("better-auth"),
```

No option for NextAuth, Clerk, Supabase Auth, or custom. The config schema uses `z.literal("better-auth")` — it's not even a union, it's a fixed value.

### 1.6 ORM — Drizzle Only

No Prisma, Kysely, or raw SQL option. Hardcoded throughout all modules.

### 1.7 Database — Postgres Only

```typescript
dialect: "postgresql",
```

No MySQL, SQLite, or Turso support.

---

## 2. Dependency Order & Pipeline Analysis

### 2.1 Init Pipeline (8 steps, sequential)

```
1. validate target directory
2. scaffold Next.js app (create-next-app)
3. move scaffold into current directory (if requested)
4. normalize repo layout (flat lib/, globals.css, drizzle.config.ts)
5. install baseline dependencies (zod, drizzle-orm, postgres, better-auth, etc.)
6. initialize shadcn/ui (init --defaults, add --all)
7. generate app icons (favicon, PWA)
8. generate public pages + auth wiring + config + env + DB + proxy.ts
```

**Ordering issues:**
- Step 4 writes `globals.css` → Step 6 (shadcn) OVERWRITES it → Step 6 re-writes `globals.css` at end. This is a known race condition the code works around by re-applying the theme after shadcn.
- Step 5 installs baseline deps → Step 6 (shadcn) may install additional deps → no dedup or conflict check.
- Step 8 writes `lib/db/schema.ts` with only `userProfiles` table → Better Auth tables come from `auth@latest generate` which runs in **baseline**, not init. So after `init`, the schema is incomplete.

### 2.2 Baseline Pipeline (13 steps, sequential)

```
1.  validate project root
2.  ensure drizzle config + folders
3.  ensure config exists (writeDefaultConfig)
4.  ensure optional env schema stubs
5.  upgrade config runtime schema (lib/0xstack/config.ts)
6.  load config + apply profile → writes state.json
7.  install module deps (capability-aware)
8.  PRD tooling (ESLint boundaries, module factories, vitest)
9.  generate Better Auth schema (auth@latest generate)
10. ensure baseline DB tables (core + modules)
11. generate Drizzle migration (drizzle-kit generate)
12. apply migrations (drizzle-kit migrate) if DATABASE_URL set
13. activate modules (routes + lib wiring) ← runs all 19 modules
14. ensure query/mutation key indices
15. upgrade public pages (if still shell templates)
16. upgrade auth pages (login/signup UX)
17. generate docs (README/PRD/ARCH/ERD + lib/*/README.md)
```

**Critical ordering issues:**

1. **Step 9 (Better Auth schema gen) runs BEFORE step 13 (module activation).** This means:
   - Auth tables are generated
   - Then `core-db-state` module adds orgs, api_keys, assets, billing tables to schema
   - Then `auth-core` module overwrites `auth-schema.ts` with a re-export
   - But the schema file already has `export * from "../auth/auth-schema"` from step 10
   - **Circular dependency risk:** `lib/db/schema.ts` → `auth-schema.ts` → `lib/db/schema.ts`

2. **Step 13 (module activation) runs ALL 19 modules in order:**
   ```
   cache → auth-core → core-db-state → ui-foundation → security-api → 
   webhook-ledger → observability → jobs → seo → blogMdx → 
   billing-core → billing-dodo → billing-stripe → 
   storage-gcs → storage-s3 → storage-supabase → storage-core → 
   email-resend → pwa
   ```
   
   **Problem:** `billing-core` generates `lib/loaders/billing.loader.ts` which imports `cacheTags.billingOrg(orgId)`. But `cache` module ran first and defined `cacheTags.billingOrg`. This works only because cache runs first. If module order changes, it breaks.

3. **Step 13 → `ui-foundation` patches `app/layout.tsx`** → then `seo` module (step 9 in module order) also patches `app/layout.tsx`. Both use string replacement with markers (`0xstack:UI-FOUNDATION`, `0xstack:SEO`). If order changes or markers collide, patches fail silently.

4. **Step 13 → `email-resend` patches `lib/auth/auth.ts`** by completely rewriting it. This overwrites any customizations the `auth-core` module made. The email module's `patchAuthForEmail()` function does a full file replacement, not a merge.

5. **Step 12 (migrate) runs BEFORE step 13 (module activation).** This means:
   - Migrations are generated from schema (step 11)
   - Migrations are applied (step 12)
   - THEN modules add more tables to schema (step 13)
   - **The newly added tables are NOT migrated until the next baseline run.**

### 2.3 Module Activation Order Dependencies

| Module | Depends On | What Happens If Missing |
|--------|-----------|------------------------|
| `auth-core` | `cache` (for viewer loader) | Breaks — imports `withServerCache`, `cacheTags` |
| `core-db-state` | `auth-core` (for `requireAuth`) | Breaks — imports `@/lib/auth/server` |
| `ui-foundation` | `auth-core` (for viewer loader) | Breaks — imports `loadViewer` |
| `billing-core` | `cache`, `core-db-state` | Breaks — imports cache tags, org services |
| `storage-core` | `cache`, `core-db-state` | Breaks — imports cache tags, org services |
| `security-api` | `core-db-state` (for api-keys repo) | Works — generates its own repo |
| `webhook-ledger` | `cache` | Breaks — imports cache tags |
| `seo` | none (patches layout) | Works independently |
| `blogMdx` | `cache`, `seo` (optional) | Works — catches blog loader missing gracefully |
| `email-resend` | `auth-core` (patches auth.ts) | Breaks if auth.ts doesn't exist |
| `pwa` | `cache` | Breaks — imports cache tags |
| `jobs` | `webhook-ledger`, `billing-core` | Breaks — imports webhook ledger service |
| `observability` | none | Works independently |

**The current order works but is fragile.** Any reordering breaks imports.

---

## 3. Frontend Design Audit — What's Polished vs What's Stubs

### 3.1 Polished Pages (Production-Ready UI)

| Page | Quality | Notes |
|------|---------|-------|
| `app/login/page.tsx` | ✅ Good | Card-based form, error handling, redirect support, forgot password link |
| `app/get-started/page.tsx` | ✅ Good | Same quality as login |
| `app/forgot-password/page.tsx` | ✅ Good | Done state, error handling |
| `app/reset-password/page.tsx` | ✅ Good | Token validation, error states |
| `app/blog/page.tsx` | ✅ Good | Featured post, card grid, tags, date formatting |
| `app/blog/[slug]/page.tsx` | ✅ Good | TOC, reading time, share buttons, related posts, JSON-LD, reading progress bar |
| `app/pricing/page.tsx` (billing) | ✅ Good | Plan cards, features list, checkout form, org gating |
| `app/app/billing/page.tsx` | ✅ Good | Subscription status, plan info, portal link |
| `app/app/webhooks/page.tsx` | ✅ Good | Event list with replay buttons |
| `app/app/api-keys/page.tsx` | ✅ Good | Create form, key list with revoke, prefix display |
| `app/app/orgs/page.tsx` | ⚠️ Basic | Card list with role display, create form — but minimal polish |
| `app/app/settings/page.tsx` | ⚠️ Basic | Links to all modules — but no actual settings form |

### 3.2 Stub/Minimal Pages

| Page | Quality | Issues |
|------|---------|--------|
| `app/page.tsx` (home) | ⚠️ Mixed | Init generates sophisticated homepage with hero/features/architecture/blog sections. But baseline OVERWRITES it with a simpler version (`mkPublicPage`). The sophisticated version is lost. |
| `app/about/page.tsx` | ⚠️ Basic | Two cards + links — minimal content |
| `app/contact/page.tsx` | ❌ Stub | Single card saying "Update this page" |
| `app/terms/page.tsx` | ❌ Stub | "Replace this with your legal terms" |
| `app/privacy/page.tsx` | ❌ Stub | "Replace this with your privacy policy" |
| `app/app/page.tsx` (workspace) | ⚠️ Basic | Quick links card — minimal |
| `app/app/assets/page.tsx` | ⚠️ Partial | Lists assets with delete — but NO upload UI |
| `app/app/assets/assets-client.tsx` | ❌ Incomplete | File was truncated at 1000 lines — upload client component may be broken |
| `app/app/pwa/page.tsx` | ⚠️ Basic | Settings + client component — minimal |
| `app/app/pwa/pwa-client.tsx` | ⚠️ Basic | Single "Enable notifications" button |

### 3.3 Missing Components (Referenced But Not Generated)

| Component | Referenced In | Generated By | Status |
|-----------|--------------|--------------|--------|
| `Badge` | blog pages, homepage, PWA | shadcn `add --all` | ✅ Exists (shadcn installs all) |
| `PwaInstallButton` | site-header.tsx | pwa module | ✅ Generated |
| `PwaUpdateBanner` | site-header.tsx | pwa module | ✅ Generated |
| `AppShell` | app/app/layout.tsx | init (step 8) | ✅ Generated (minimal) |
| `useTheme` (next-themes) | theme-toggle.tsx | ui-foundation | ⚠️ `next-themes` is NOT installed as a dep — **runtime error** |
| `lucide-react` icons | theme-toggle, PWA components | shadcn `add --all` | ✅ Exists (shadcn installs) |
| `MDXRemote` | blog post page | blogMdx module | ✅ `next-mdx-remote` installed when blog enabled |
| `remark-toc` | blog post page | blogMdx module | ❌ **NOT in deps list** — `remarkGfm` is installed but `remarkToc` is missing |
| `prose` (Tailwind typography) | blog post page | blogMdx module | ❌ `@tailwindcss/typography` NOT installed — prose classes won't work |

### 3.4 Runtime Errors (Missing Dependencies)

| Missing Dep | Used In | Impact |
|-------------|---------|--------|
| `next-themes` | `theme-toggle.tsx` | **Crash** — `useTheme` import fails |
| `remark-toc` | `blog/[slug]/page.tsx` | **Crash** — import fails when blog enabled |
| `@tailwindcss/typography` | `blog/[slug]/page.tsx` (prose classes) | **Silent** — prose classes don't apply, blog looks unstyled |
| `lru-cache` | `cache/lru.ts` | ❌ Not in init deps, but IS in baseline deps — works after baseline |
| `web-push` | PWA push service | ❌ Type declaration exists but package only installed when PWA enabled in baseline |
| `idb` | PWA offline storage | ❌ Same as web-push |
| `schema-dts` | SEO module | ✅ Installed in baseline when SEO enabled |
| `gray-matter` | blog loader | ✅ Installed in baseline when blog enabled |
| `rehype-slug`, `rehype-autolink-headings` | blog module | ✅ Listed in baseline deps but NOT actually used in blog post page (only remark plugins used) |

---

## 4. Actual Code-Level Wiring Issues

### 4.1 `next-themes` Not Installed

**File:** `core/modules/ui-foundation.module.ts` generates `theme-toggle.tsx`:
```typescript
import { useTheme } from "next-themes";
```

**But:** `next-themes` is never added to deps in `run-init.ts` or `run-baseline.ts`. The `ThemeProvider` in `providers.tsx` also imports from `next-themes`.

**Impact:** Any app that runs `baseline` will have a broken theme toggle. The app won't crash on the server (SSR), but client-side hydration will fail.

### 4.2 `remark-toc` Not Installed

**File:** `core/modules/blog.module.ts` generates blog post page:
```typescript
import remarkToc from "remark-toc";
```

**But:** Baseline deps for blog only include: `gray-matter`, `next-mdx-remote`, `remark-gfm`, `rehype-slug`, `rehype-autolink-headings`. No `remark-toc`.

**Impact:** Blog post page crashes on render.

### 4.3 `@tailwindcss/typography` Not Installed

**File:** `core/modules/blog.module.ts` generates:
```tsx
<div className="prose prose-neutral dark:prose-invert max-w-none">
```

**But:** `@tailwindcss/typography` is never installed.

**Impact:** Blog content renders without typography styling — plain text, no heading sizes, no list styling.

### 4.4 SEO Module Patches Layout Aggressively

**File:** `core/modules/seo.module.ts` — `patchRootLayoutForSeo()`

This function does multiple string replacements on `app/layout.tsx`:
1. Adds imports after `globals.css` import
2. Adds `Metadata` type import
3. Adds `export const metadata` before `export default function RootLayout`
4. Injects JSON-LD scripts into `<body>`

**Problem:** If `ui-foundation` already patched the layout (adding Providers, SiteHeader, SiteFooter), the SEO module's regex may not match correctly. The `0xstack:SEO` marker check prevents double-patching, but if SEO runs before ui-foundation, the SEO patches get overwritten.

**Current order:** ui-foundation (4th) → seo (9th). So SEO patches after ui-foundation. This works but is fragile.

### 4.5 Email Module Overwrites auth.ts Completely

**File:** `core/modules/email-resend.module.ts` — `patchAuthForEmail()`

```typescript
const next = `import { betterAuth } from "better-auth";
// ... entire file content hardcoded ...
`;
await fs.writeFile(authPath, next, "utf8");
```

This completely replaces `lib/auth/auth.ts` with a hardcoded template. If the user has customized their auth config (e.g., added OAuth providers, custom database hooks), this wipes it out.

### 4.6 PWA Module Patches Layout Too

**File:** `core/modules/pwa.module.ts` — `patchRootLayoutForPwa()`

Another layout patch function. Now we have 3 modules patching `app/layout.tsx`:
1. `ui-foundation` — adds Providers, SiteHeader, SiteFooter
2. `seo` — adds metadata export, JSON-LD scripts
3. `pwa` — adds manifest link, theme-color meta tags

Each uses different markers and regex patterns. If any two run in wrong order, patches conflict.

### 4.7 Cache Tags Reference Non-Existent Tags

**File:** `core/modules/cache.module.ts` defines:
```typescript
export const cacheTags = {
  projects: "projects",       // ← Not used anywhere
  companies: "companies",     // ← Not used anywhere
  jobs: "jobs",               // ← Not used anywhere
  trending: "trending",       // ← Not used anywhere
  dashboard: "dashboard",     // ← Used in revalidate
  viewer: "viewer",           // ← Used in viewer loader
  // ... entity helpers
  billingOrg: (orgId) => `billing:org:${orgId}`,  // ← Used by billing
  assetsOrg: (orgId) => `assets:org:${orgId}`,    // ← Used by storage
  // ...
};
```

**Issue:** `projects`, `companies`, `jobs`, `trending` are leftover from a previous project template. They're not used in 0xstack. Meanwhile, `orgsForUser` IS used but the tag name doesn't match the domain (orgs, not projects).

### 4.8 Generated Domain Loaders Use Wrong Cache Tags

**File:** `core/generate/run-generate-domain.ts`

```typescript
const load${pascal}ListCached = withServerCache(
  async (orgId: string) => await ${camel}Service_list({ orgId }),
  {
    key: (orgId: string) => ["${plural}", "org", orgId],
    tags: (orgId: string) => [cacheTags.billingOrg(orgId)],  // ← WRONG!
    revalidate: CACHE_TTL.DASHBOARD,
  }
);
```

Every generated domain loader uses `cacheTags.billingOrg(orgId)` for its cache tags. A "projects" domain would use `billing:org:${orgId}` tags. This means invalidating billing would also invalidate all other domains, and invalidating a specific domain wouldn't work correctly.

### 4.9 Storage Upload Route Has Dual Auth Path (Confusing)

**File:** `storage-core.module.ts` — sign-upload route

```typescript
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (session?.user?.id) {
    // Path A: session auth — check org membership
    const orgId = getActiveOrgIdFromCookies(await cookies());
    // ... org-scoped upload
  }
  // Path B: API key auth — external surface
  await guardApiRequest(req);
  // ... external upload (no org scoping required)
}
```

The same route handles both session-based (internal) and API-key-based (external) auth. This is confusing because:
- External uploads don't require org scoping (only `ownerUserId` or `orgId` in body)
- Internal uploads require active org cookie
- The response shape differs between paths

### 4.10 Billing Checkout Routes Don't Use guardApiRequest()

**File:** `billing-dodo.module.ts` — checkout route

```typescript
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers as any });
  if (!session?.user?.id) await guardApiRequest(req);  // ← Only if no session
  return handler(req as any);
}
```

This means:
- Logged-in users bypass API key check AND rate limiting
- External users (no session) get API key check but the Dodo handler may reject them anyway
- Rate limiting is NOT applied to session-authenticated requests

### 4.11 Blog Loader Imports from Wrong Path

**File:** `core/modules/seo.module.ts` — sitemap.ts

```typescript
import { listPosts } from "@/lib/loaders/blog.loader";
```

This import is in the sitemap, which runs at build time. If the blog module is disabled, this import still exists in the sitemap file. The code wraps it in try/catch, but the import itself will cause a module resolution error if `blog.loader.ts` doesn't exist.

**Current mitigation:** When blog is disabled, the sitemap file is NOT removed (it's generated by SEO module, not blog module). So SEO + no-blog = broken sitemap import.

### 4.12 `lib/env/schema.ts` Composition Issue

**File:** `core/init/run-init.ts` (step 8)

```typescript
import { BillingEnvSchema } from "./billing";
import { StorageEnvSchema } from "./storage";

export const EnvSchema = z.object({...})
  .and(BillingEnvSchema.partial())
  .and(StorageEnvSchema.partial());
```

**Problem:** `lib/env/billing.ts` and `lib/env/storage.ts` are generated by their respective modules during baseline. But `lib/env/schema.ts` is generated during init (before baseline). At init time, these files don't exist yet.

**Current mitigation:** The init step creates stub `lib/env/billing.ts` and `lib/env/storage.ts` files. But if a user runs `init` without billing/storage enabled, the schema still imports them.

---

## 5. Missing Features Not Exposed

### 5.1 No Component Selection

Users can't choose which shadcn components to install. `shadcn add --all` installs everything including:
- `sidebar` (not used)
- `carousel` (not used)
- `calendar` (not used)
- `chart` (not used)
- `resizable` (not used)
- `drawer` (not used)
- `dialog` (not used — uses custom modals)
- `popover` (not used)
- `tooltip` (not used)
- `context-menu` (not used)
- `dropdown-menu` (not used)
- `hover-card` (not used)
- `navigation-menu` (not used)
- `scroll-area` (not used)
- `select` (not used)
- `separator` (not used)
- `sheet` (not used)
- `skeleton` (not used)
- `slider` (not used)
- `switch` (not used)
- `table` (not used)
- `tabs` (not used)
- `textarea` (not used)
- `toast` (not used)
- `toggle` (not used)
- `toggle-group` (not used)
- `accordion` (not used)
- `alert` (not used)
- `alert-dialog` (not used)
- `aspect-ratio` (not used)
- `avatar` (not used)
- `badge` (used in blog)
- `breadcrumb` (not used)
- `button` (used everywhere)
- `card` (used everywhere)
- `checkbox` (not used)
- `collapsible` (not used)
- `command` (not used)
- `form` (not used)
- `input` (used everywhere)
- `input-otp` (not used)
- `label` (not used)
- `menubar` (not used)
- `pagination` (not used)
- `progress` (not used)
- `radio-group` (not used)

**Actually used components:** button, card, input, badge (blog), and that's about it. ~45 components are dead code.

### 5.2 No Font Selection

Fonts are baked into themes:
- Default: Geist
- Corporate Blue: Inter + Merriweather + JetBrains Mono
- Amber: Inter + Source Serif 4 + JetBrains Mono
- Grass: Outfit + serif + monospace

No option to use Google Fonts, local fonts, or custom font stacks.

### 5.3 No Layout Options

- No sidebar layout option
- No dashboard template option
- No marketing site template option
- No choice of header/footer style

### 5.4 No Testing Framework Choice

Vitest is hardcoded. No Jest, Playwright, or Cypress option.

### 5.5 No Deployment Target Choice

No Vercel, Netlify, Docker, or self-hosted option.

---

## 6. Pages/Components That Reference Missing Things

### 6.1 Settings Page Links to Non-Existent Pages

**File:** `ui-foundation.module.ts` — settings page

```tsx
<Link href="/app/pwa">PWA</Link>
<Link href="/app/webhooks">Webhooks</Link>
```

These links are always rendered, but:
- `/app/pwa` only exists when PWA module is enabled
- `/app/webhooks` only exists when webhook-ledger module is enabled (always-on)

If PWA is disabled, the link 404s.

### 6.2 Site Header Links to Blog When Blog Disabled

**File:** `ui-foundation.module.ts` — site-header.tsx

```tsx
<Link href="/blog">Blog</Link>
```

This link is always in the header, regardless of whether the blog module is enabled. Clicking it 404s when blog is off.

### 6.3 Homepage References Billing/Storage When Disabled

**File:** `ui-foundation.module.ts` — home page

```tsx
<li>Storage (GCS) signed URLs + asset index</li>
<li>Billing (Dodo) webhook ledger + subscription read model</li>
```

These are hardcoded in the homepage regardless of module state.

### 6.4 Blog Post Page Uses `remarkToc` Without Dependency

Already covered in section 4.2.

### 6.5 Theme Toggle Uses `next-themes` Without Dependency

Already covered in section 4.1.

---

## 7. What's Actually a Stub vs What's Real

### Real (Production-Ready Code)

| Component | Files | Quality |
|-----------|-------|---------|
| Better Auth integration | 15 files | ✅ Full handler, pages, client, viewer, email wiring |
| Org multi-tenant | 12 files | ✅ Tables, membership, roles, active-org cookie, resolution logic |
| API key management | 8 files | ✅ Hash storage, prefix lookup, timing-safe, CRUD UI, org-scoped |
| Cache layer | 5 files | ✅ LRU + Next.js Data Cache + tag revalidation |
| Structured logger | 1 file | ✅ Redaction, dev/prod formatting, Sentry integration |
| Webhook ledger | 8 files | ✅ Idempotency table, list/replay service, admin UI |
| Billing reconciliation | 12 files | ✅ Dodo + Stripe webhook handling, subscription read model |
| Storage service | 12 files | ✅ Multi-provider factory, signed URLs, org scoping, access control |
| SEO module | 8 files | ✅ JSON-LD, metadata, robots, sitemap, OG images, dynamic OG route |
| Blog MDX | 5 files | ✅ MDX pipeline, frontmatter validation, RSS, per-post OG images |
| Email templates | 7 files | ✅ React Email, verify/reset/welcome templates, Resend wiring |
| Doctor command | 657 lines | ✅ Env, deps, files, boundaries, CQRS purity, migration drift |
| Baseline command | 993 lines | ✅ Idempotent reconciliation pipeline |
| Domain generator | 380 lines | ✅ Full CQRS slice with org scoping |

### Partial (Scaffolded But Not Cohesive)

| Component | What's Missing |
|-----------|---------------|
| Billing UX | No renewal date, invoices, state transitions display |
| Storage UX | No upload flow (file picker → sign-upload → PUT → refresh) |
| Rate limiting | Not on all `/api/v1/*` routes (billing webhook/storage skip it) |
| Cache tags | Not applied broadly beyond viewer; wrong tags in generated domains |
| PWA | No settings UI polish, basic SW strategy |
| Orgs UI | Minimal polish, no empty states |

### Stubs (Minimal/Placeholder)

| Component | What It Actually Is |
|-----------|-------------------|
| Jobs module | 2 files — reconcile endpoint that replays Dodo webhooks. No scheduler. |
| Release command | 30 lines — shells to changesets or prints hints |
| Upgrade command | 45 lines — env/config updates only, explicitly excludes codemods |
| `install()` hooks | Empty for all 19 modules |
| `sync()` hooks | Empty for all 19 modules |
| Test stubs | 3 files per domain — only check exports and basic Zod validation |
| `wrap` command | Prints help text |
| `modules` command | Hardcoded text output |
| Contact page | "Update this page with your channels" |
| Terms page | "Replace this with your legal terms" |
| Privacy page | "Replace this with your privacy policy" |

---

## 8. Dependency Installation Gaps

### Installed During Init
```
zod, drizzle-orm, postgres, better-auth, @better-auth/drizzle-adapter,
@tanstack/react-query, zustand
Dev: drizzle-kit
```

### Installed During Baseline (when modules enabled)
```
Always: @upstash/redis, @upstash/ratelimit, vitest, vite
blogMdx: gray-matter, next-mdx-remote, remark-gfm, rehype-slug, rehype-autolink-headings
seo: schema-dts
billing-dodo: @dodopayments/nextjs, standardwebhooks
billing-stripe: stripe
storage-gcs: @google-cloud/storage
storage-s3: @aws-sdk/client-s3, @aws-sdk/s3-request-presigner
storage-supabase: @supabase/supabase-js
email-resend: resend, @react-email/components, @react-email/render
cache: lru-cache
pwa: web-push, idb
observability-sentry: @sentry/nextjs
```

### NEVER Installed But Required
```
next-themes        ← Used by theme-toggle.tsx and providers.tsx
remark-toc         ← Used by blog/[slug]/page.tsx
@tailwindcss/typography ← Used by blog/[slug]/page.tsx (prose classes)
```

### Installed But Not Used
```
rehype-slug        ← Listed in deps but not imported in blog page
rehype-autolink-headings ← Listed in deps but not imported in blog page
zustand            ← Installed during init but never used anywhere
@upstash/redis     ← Only used conditionally in guardApiRequest
@upstash/ratelimit ← Only used conditionally in guardApiRequest
```

---

## 9. Recommended Fixes (Priority Order)

### P0 — Runtime Errors (App Won't Work)
1. **Add `next-themes` to baseline deps** — theme toggle crashes without it
2. **Add `remark-toc` to blog deps** — blog post page crashes without it
3. **Add `@tailwindcss/typography` to blog deps** — blog content unstyled without it
4. **Fix sitemap import when blog disabled** — SEO module generates broken import

### P1 — Security Gaps
5. **Enforce `guardApiRequest()` on ALL `/api/v1/*` routes** — billing webhook, storage, etc.
6. **Add rate limiting to session-authenticated API routes** — currently bypassed
7. **Add webhook signature verification to all webhook routes** — Stripe may not verify

### P2 — Architecture Cohesion
8. **Fix cache tags in generated domain loaders** — use domain-specific tags, not `billingOrg`
9. **Add `requireActiveOrg()` to all `/app/*` pages** — or at least layout-level guard
10. **Remove dead cache tags** — `projects`, `companies`, `jobs`, `trending`

### P3 — UX Completeness
11. **Add storage upload flow** — file picker → sign-upload → PUT → refresh
12. **Complete billing status UI** — renewal date, invoices, state transitions
13. **Polish orgs UI** — empty states, better card design

### P4 — Developer Experience
14. **Add `--src-dir` flag to init** — let users choose layout
15. **Add `--no-shadcn-all` flag** — let users pick components
16. **Add `remove` command** — disable modules cleanly
17. **Write runbooks** — one per module

### P5 — Code Quality
18. **Replace regex config patching with AST** — `config-patch.ts` is fragile
19. **Add CLI integration tests** — zero tests currently
20. **Make module order explicit** — document dependencies, add validation

---

## 10. Conclusion

The CLI generates **real, functional architecture** — not fake stubs. The CQRS pipeline, auth integration, org multi-tenancy, and security foundations are genuinely production-minded.

However, there are **three categories of problems**:

1. **Runtime errors** (missing deps: `next-themes`, `remark-toc`, `@tailwindcss/typography`) — these will crash the app immediately after baseline.
2. **Hardcoded opinions** (no user choice on Next.js options, shadcn components, fonts, auth provider, ORM, DB) — the CLI is opinionated by design but should at least document this and offer escape hatches.
3. **Wiring gaps** (cache tags wrong, rate limiting not universal, active-org not enforced, layout patching fragile) — the pieces exist but aren't consistently applied.

The gap is **not missing features** — it's **inconsistent application of existing features** plus **a few critical missing dependencies**.
