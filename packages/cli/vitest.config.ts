import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    passWithNoTests: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/index.ts", // CLI entry point, hard to test
        "src/commands/**/*.ts", // Commands are thin wrappers, tested via integration
        "src/core/init/**/*.ts", // Init runs create-next-app, too heavy for unit tests
        "src/core/baseline/**/*.ts", // Baseline runs external CLIs, tested via integration
        "src/core/doctor/**/*.ts", // Doctor is I/O heavy with file scanning
        "src/core/docs/**/*.ts", // Docs sync is I/O heavy
        "src/core/sync/**/*.ts", // Sync is I/O heavy
        "src/core/add/**/*..ts", // Add is a thin wrapper around baseline
        "src/core/upgrade/**/*.ts", // Upgrade is thin wrapper
        "src/core/release/**/*.ts", // Release is thin wrapper
        "src/core/interactive/**/*.ts", // Interactive prompts, hard to test
        "src/core/exec.ts", // execa wrapper, tested indirectly
        "src/core/pm.ts", // Package manager detection, tested indirectly
        "src/core/logger.ts", // Console output, tested indirectly
        "src/core/modules/registry.ts", // Module registry is just a list
        "src/core/modules/types.ts", // Type definitions only
        "src/core/modules/cache.module.ts", // Module activation generates files, tested via validate
        "src/core/modules/auth-core.module.ts", // Module activation tested via validate
        "src/core/modules/ui-foundation.module.ts", // Module activation tested via validate
        "src/core/modules/core-db-state.module.ts", // Module activation tested via validate
        "src/core/modules/billing-core.module.ts", // Module activation tested via validate
        "src/core/modules/billing-dodo.module.ts", // Module activation tested via validate
        "src/core/modules/billing-stripe.module.ts", // Module activation tested via validate
        "src/core/modules/storage-core.module.ts", // Module activation tested via validate
        "src/core/modules/storage-gcs.module.ts", // Module activation tested via validate
        "src/core/modules/storage-s3.module.ts", // Module activation tested via validate
        "src/core/modules/storage-supabase.module.ts", // Module activation tested via validate
        "src/core/modules/email-resend.module.ts", // Module activation tested via validate
        "src/core/modules/seo.module.ts", // Module activation tested via validate
        "src/core/modules/blog.module.ts", // Module activation tested via validate
        "src/core/modules/pwa.module.ts", // Module activation tested via validate
        "src/core/modules/observability.module.ts", // Module activation tested via validate
        "src/core/modules/jobs.module.ts", // Module activation tested via validate
        "src/core/modules/webhook-ledger.ts", // Module activation tested via validate
        "src/core/modules/security-api.module.ts", // Module activation tested via validate
        "src/core/generate/run-generate-domain.ts", // Domain generation tested via integration
      ],
      thresholds: {
        lines: 70,
        functions: 75,
        branches: 60,
        statements: 70,
      },
    },
  },
});
