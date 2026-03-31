import { defineConfig } from "./lib/0xstack/config";

export default defineConfig({
  app: { name: "theme-app", baseUrl: "http://localhost:3000" },
  modules: {
    // init enables core (auth fixed) + your selected modules.
    orgs: true,
    billing: false,
    storage: false,
    email: false,
    cache: true,
    pwa: false,
    seo: false,
    blogMdx: false,
  },
  profiles: {
    core: { modules: { orgs: true, billing: false, storage: false, email: false, cache: true, pwa: false, seo: false, blogMdx: false } },
    full: { modules: { orgs: true, billing: "dodo", storage: "gcs", email: "resend", cache: true, pwa: true, seo: true, blogMdx: true, jobs: { enabled: true, driver: "cron-only" } } },
  },
});
