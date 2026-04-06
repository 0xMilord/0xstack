export type ModuleId =
  | "orgs"
  | "ui-foundation"
  | "auth-core"
  | "cache"
  | "core-db-state"
  | "security-api"
  | "webhook-ledger"
  | "seo"
  | "blogMdx"
  | "billing-core"
  | "billing-dodo"
  | "billing-stripe"
  | "storage-gcs"
  | "storage-s3"
  | "storage-supabase"
  | "storage-core"
  | "email-resend"
  | "pwa"
  | "observability"
  | "jobs";

export type ModuleContext = {
  projectRoot: string;
  profile: string;
  modules: {
    seo: boolean;
    blogMdx: boolean;
    billing: false | "dodo" | "stripe";
    storage: false | "gcs" | "s3" | "supabase";
    email: false | "resend";
    cache: boolean;
    pwa: boolean;
    // P0 #11: Removed otel — was phantom feature (zero implementation)
    observability: { sentry: boolean };
    jobs: { enabled: boolean; driver: "inngest" | "cron-only" };
  };
};

export type Module = {
  id: ModuleId;
  install: (ctx: ModuleContext) => Promise<void>;
  activate: (ctx: ModuleContext) => Promise<void>;
  validate: (ctx: ModuleContext) => Promise<void>;
  sync: (ctx: ModuleContext) => Promise<void>;
};

