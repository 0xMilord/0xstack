import { defineConfig } from "./lib/0xstack/config";

export default defineConfig({
  app: { name: "verify-app", baseUrl: "http://localhost:3000" },
  modules: {
    auth: "better-auth",
    // init enables core (auth fixed) + your selected modules.
    orgs: true,
    billing: "dodo",
    storage: "gcs",
    email: "resend",
    cache: true,
    pwa: true,
    seo: true,
    blogMdx: true,
    observability: { sentry: false, otel: false },
    jobs: { enabled: true, driver: "cron-only" },
  },
  profiles: {
    core: { modules: { orgs: true, billing: false, storage: false, email: false, cache: true, pwa: false, seo: false, blogMdx: false, observability: { sentry: false, otel: false }, jobs: { enabled: false, driver: "cron-only" } } },
    full: { modules: { orgs: true, billing: "dodo", storage: "gcs", email: "resend", cache: true, pwa: true, seo: true, blogMdx: true, observability: { sentry: false, otel: false }, jobs: { enabled: true, driver: "cron-only" } } },
  },
});
