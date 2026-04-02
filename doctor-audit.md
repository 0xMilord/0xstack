# 🔍 Doctor Command Audit

**Audit Date:** 2026-04-02  
**Version:** 0.1.5  
**Status:** ⚠️ **PARTIAL - Needs Enhancement**

---

## 📋 Executive Summary

The `doctor` command is a **static analysis tool** that validates project structure, dependencies, and architecture constraints. It's **not a healer** - it only reports issues. Users must run `baseline` to fix them.

**Key Findings:**
- ✅ Does NOT overwrite user work (read-only checks)
- ✅ Provides detailed error messages
- ❌ No TUI graphics or visual health dashboard
- ❌ No interactive fix suggestions
- ❌ No combined `tsc + doctor` mode
- ❌ No drift detection over time
- ❌ No scan options (quick vs full)

---

## 🎯 Intended Purpose (PRD Claims)

From PRD.md:
> "`doctor` — validate env, deps, and architecture constraints"

**Claimed Capabilities:**
1. Env vars present and correct format
2. Drizzle migrations state
3. Folder conventions exist
4. Architecture constraints (no repo called directly from UI/API)
5. Query key conventions
6. Enterprise baselines enabled

---

## 🔍 Current Implementation Analysis

### ✅ What Works

| Feature | Implementation | Quality |
|---------|---------------|---------|
| **File existence checks** | `fs.access()` for required files | ✅ Solid |
| **Dependency parity** | Compares expected vs actual deps | ✅ Solid |
| **Env schema validation** | Checks for required keys | ✅ Solid |
| **Boundary enforcement** | Static scan for banned imports | ✅ Solid |
| **Module gating** | Checks disabled modules removed files | ✅ Solid |
| **Migration drift** | Journal ↔ files comparison | ⚠️ Basic |
| **Strict mode** | `--strict` flag for PRD hygiene | ✅ Good |

### ❌ What's Missing

| Feature | Status | Impact |
|---------|--------|--------|
| **TUI graphics** | ❌ Missing | No visual repo health dashboard |
| **Progress bars** | ❌ Missing | No scan progress indication |
| **Interactive fixes** | ❌ Missing | Can't auto-fix issues |
| **Drift detection** | ❌ Missing | No historical tracking |
| **Scan modes** | ❌ Missing | No quick/full scan options |
| **tsc integration** | ❌ Missing | Must run separately |
| **Export reports** | ❌ Missing | Can't save/share results |
| **CI output format** | ❌ Missing | No JSON/JUnit output |
| **Performance** | ⚠️ Basic | No caching, scans all files every time |

---

## 🚪 Does It Overwrite User Work?

**NO.** Doctor is **read-only**:

```typescript
// Only reads files, never writes
async function exists(p: string) {
  try {
    await fs.access(p);  // ← Read-only check
    return true;
  } catch {
    return false;
  }
}

// Only collects issues, never modifies
const note = (msg: string) => issues.push(msg);  // ← Just records
```

**Safe for CI/CD** - no side effects.

---

## 📊 Current Output Format

```
doctor: Missing eslint.0xstack-boundaries.mjs — run `0xstack baseline`...
doctor: Missing lib/services/module-factories.ts — run `0xstack baseline`...
Error: doctor failed (core):
- Missing dependencies for enabled modules: @upstash/ratelimit, @upstash/redis, lru-cache
- keys.indices: missing lib/query-keys/index.ts, lib/mutation-keys/index.ts
- foundation.ui: missing app/providers.tsx
- foundation.orgs.active: missing lib/orgs/active-org.ts
...
```

**Quality:** ✅ Clear, actionable  
**Missing:** ❌ No severity levels, no categories, no fix commands

---

## 🔧 CLI Options (Current)

```bash
npx 0xstack doctor [options]

Options:
  --dir <dir>       Project directory (default: current)
  --profile <profile>  Profile preset (default: core)
  --strict          Fail on PRD hygiene too
```

**Missing Options:**
- `--quick` - Fast scan (skip strict checks)
- `--json` - Output as JSON for CI
- `--fix` - Auto-fix what's possible
- `--watch` - Continuous monitoring
- `--report` - Generate HTML report
- `--cache` - Use cached results

---

## 🎨 TUI Graphics - What's Missing

**Current:** Plain text output only

**Should Have:**
```
┌─────────────────────────────────────────┐
│  🏥 0xstack Health Check                │
├─────────────────────────────────────────┤
│  ✅ Env validation       (5/5 checks)   │
│  ⚠️  Dependencies        (3 missing)    │
│  ❌ Architecture         (2 violations) │
│  ✅ Migrations           (OK)           │
├─────────────────────────────────────────┤
│  Health Score: 72/100                   │
│                                         │
│  Quick Fixes:                           │
│  [1] Run: 0xstack baseline --profile core │
│  [2] Run: pnpm install                  │
└─────────────────────────────────────────┘
```

---

## 📈 Drift Detection

**Current:** None. Doctor only checks current state.

**Should Have:**
```typescript
// Track changes over time
interface DoctorHistory {
  timestamp: string;
  score: number;
  issues: string[];
}

// Detect new issues since last run
function detectDrift(current: Issue[], previous: Issue[]) {
  return current.filter(c => !previous.find(p => p.id === c.id));
}
```

---

## 🔬 tsc + Doctor Integration

**Current:** Separate commands
```bash
pnpm tsc --noEmit
npx 0xstack doctor
```

**Should Have:**
```bash
# Combined mode
npx 0xstack doctor --with-types

# Or in package.json
{
  "scripts": {
    "validate": "0xstack doctor --with-types"
  }
}
```

---

## 🏗️ Architecture Checks (What's Validated)

### ✅ Implemented

| Check | Description |
|-------|-------------|
| **No direct repo imports** | `app/**` can't import `@/lib/repos` |
| **No direct DB imports** | `app/**` can't import `@/lib/db` |
| **Loader purity** | Loaders can't import actions/rules |
| **Service boundaries** | Services can't import actions/loaders |
| **Module gating** | Disabled modules have no files |

### ❌ Missing

| Check | Why It Matters |
|-------|---------------|
| **Circular dependencies** | Can cause runtime errors |
| **Unused exports** | Code bloat |
| **Type safety** | Only file checks, no type analysis |
| **API route coverage** | Are all v1 routes guarded? |
| **Cache tag usage** | Are loaders using tags? |

---

## 📋 Recommendations

### Phase 1: Quick Wins (1-2 hours)
1. Add `--json` output for CI
2. Add severity levels (error/warning/info)
3. Group issues by category
4. Add health score (0-100)

### Phase 2: TUI Enhancement (4-6 hours)
1. Add chalk colors for severity
2. Add progress bars for scans
3. Add ASCII health dashboard
4. Add interactive fix prompts

### Phase 3: Advanced Features (8-12 hours)
1. Add `--watch` mode
2. Add drift detection (store `.0xstack/doctor-history.json`)
3. Add `--fix` for auto-fixable issues
4. Add HTML report generation

### Phase 4: Integration (4-6 hours)
1. Add `--with-types` for tsc integration
2. Add GitHub Actions output format
3. Add pre-commit hook integration
4. Add caching for faster re-runs

---

## 🎯 Verdict

| Aspect | Score | Notes |
|--------|-------|-------|
| **Correctness** | ✅ 9/10 | Accurate checks, no false positives |
| **Usability** | ⚠️ 6/10 | Clear errors but no TUI |
| **Performance** | ⚠️ 6/10 | No caching, scans all files |
| **Features** | ⚠️ 5/10 | Basic checks, no advanced features |
| **CI/CD Ready** | ⚠️ 6/10 | No JSON output, exit codes work |
| **User Experience** | ⚠️ 5/10 | Text-only, no visual feedback |

**Overall: 6.2/10 - Functional but needs polish**

---

## 🔧 What Users See Today

```bash
$ npx 0xstack doctor

doctor: Missing eslint.0xstack-boundaries.mjs...
doctor: Missing lib/services/module-factories.ts...
file:///.../dist/index.js:10745
    throw new Error(`doctor failed (${input.profile}):
...
Error: doctor failed (core):
- Missing dependencies...
- keys.indices: missing...
- foundation.ui: missing...
```

**Problems:**
1. ❌ No summary (how many issues total?)
2. ❌ No categories (deps vs files vs config)
3. ❌ No severity (what's critical vs nice-to-have?)
4. ❌ No fix command (what do I run first?)
5. ❌ Throws error (can't see partial results)

---

## ✅ What It Should Look Like

```bash
$ npx 0xstack doctor

┌──────────────────────────────────────────┐
│  🔍 0xstack Doctor — Scanning...         │
├──────────────────────────────────────────┤
│  ⏳ Scanning files...  ✓                 │
│  ⏳ Checking deps...    ✓                 │
│  ⏳ Validating env...   ✓                 │
│  ⏳ Architecture...     ⚠️ 2 issues       │
├──────────────────────────────────────────┤
│                                          │
│  📊 Health Score: 72/100                 │
│                                          │
│  ❌ Critical (2)                         │
│    • Missing @upstash/ratelimit          │
│    • Missing lib/orgs/active-org.ts      │
│                                          │
│  ⚠️  Warnings (3)                        │
│    • Missing eslint boundaries           │
│    • Missing module factories            │
│    • No migrations found                 │
│                                          │
│  💡 Quick Fix:                           │
│    npx 0xstack baseline --profile core   │
│                                          │
└──────────────────────────────────────────┘
```

---

**End of Audit**
