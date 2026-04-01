import { z } from "zod";

const ConfigSchema = z.object({
  app: z.object({ name: z.string(), baseUrl: z.string().url() }),
  modules: z.object({
    auth: z.literal("better-auth").optional(),
    orgs: z.boolean(),
    billing: z.union([z.literal(false), z.literal("dodo"), z.literal("stripe")]),
    storage: z.union([z.literal(false), z.literal("gcs"), z.literal("s3"), z.literal("supabase")]),
    email: z.union([z.literal(false), z.literal("resend")]),
    cache: z.boolean().optional(),
    pwa: z.boolean().optional(),
    seo: z.boolean(),
    blogMdx: z.boolean(),
    observability: z.object({ sentry: z.boolean(), otel: z.boolean() }).optional(),
    jobs: z.object({ enabled: z.boolean(), driver: z.enum(["inngest", "cron-only"]) }).optional(),
  }),
  profiles: z.record(z.string(), z.any()).optional(),
});

export function defineConfig<T extends z.input<typeof ConfigSchema>>(config: T) {
  return ConfigSchema.parse(config);
}
