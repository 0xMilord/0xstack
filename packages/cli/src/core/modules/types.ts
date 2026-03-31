export type ModuleId =
  | "orgs"
  | "cache"
  | "seo"
  | "blogMdx"
  | "billing-dodo"
  | "storage-gcs"
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
    billing: false | "dodo";
    storage: false | "gcs";
    email: false | "resend";
    cache: boolean;
    pwa: boolean;
    observability: { sentry: boolean; otel: boolean };
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

