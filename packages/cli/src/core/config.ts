import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";

export const ConfigSchema = z.object({
  app: z
    .object({
      name: z.string().min(1).default("MyApp"),
      description: z.string().optional(),
      baseUrl: z.string().url().default("http://localhost:3000"),
      envMode: z.enum(["strict", "warn"]).default("strict"),
    })
    .default({ name: "MyApp", baseUrl: "http://localhost:3000", envMode: "strict" }),
  modules: z
    .object({
      auth: z.literal("better-auth").default("better-auth"),
      orgs: z.boolean().default(true),
      billing: z.union([z.literal(false), z.literal("dodo")]).default(false),
      storage: z.union([z.literal(false), z.literal("gcs")]).default(false),
      email: z.union([z.literal(false), z.literal("resend")]).default(false),
      pwa: z.boolean().default(false),
      seo: z.boolean().default(false),
      blogMdx: z.boolean().default(false),
      observability: z
        .object({
          sentry: z.boolean().default(false),
          otel: z.boolean().default(false),
        })
        .default({ sentry: false, otel: false }),
      jobs: z
        .object({
          enabled: z.boolean().default(false),
          driver: z.enum(["inngest", "cron-only"]).default("cron-only"),
        })
        .default({ enabled: false, driver: "cron-only" }),
    })
    .default({
      auth: "better-auth",
      orgs: true,
      billing: false,
      storage: false,
      email: false,
      pwa: false,
      seo: false,
      blogMdx: false,
      observability: { sentry: false, otel: false },
      jobs: { enabled: false, driver: "cron-only" },
    }),
  conventions: z
    .object({
      routesBase: z.literal("app").default("app"),
      dashboardPrefix: z.string().default("/app"),
      idStrategy: z.literal("text").default("text"),
    })
    .default({ routesBase: "app", dashboardPrefix: "/app", idStrategy: "text" }),
  profiles: z
    .record(
      z.string(),
      z.object({
        modules: z
          .object({
            orgs: z.boolean().optional(),
            billing: z.union([z.literal(false), z.literal("dodo")]).optional(),
            storage: z.union([z.literal(false), z.literal("gcs")]).optional(),
            email: z.union([z.literal(false), z.literal("resend")]).optional(),
            pwa: z.boolean().optional(),
            seo: z.boolean().optional(),
            blogMdx: z.boolean().optional(),
            observability: z
              .object({ sentry: z.boolean().optional(), otel: z.boolean().optional() })
              .optional(),
            jobs: z
              .object({ enabled: z.boolean().optional(), driver: z.enum(["inngest", "cron-only"]).optional() })
              .optional(),
          })
          .optional(),
      })
    )
    .default({}),
});

export type MilordConfig = z.infer<typeof ConfigSchema>;

export function applyProfile(config: MilordConfig, profile: string): MilordConfig {
  const patch = config.profiles?.[profile]?.modules;
  if (!patch) return config;
  return ConfigSchema.parse({
    ...config,
    modules: {
      ...config.modules,
      ...patch,
      observability: { ...config.modules.observability, ...(patch.observability ?? {}) },
      jobs: { ...config.modules.jobs, ...(patch.jobs ?? {}) },
    },
  });
}

export async function writeDefaultConfig(
  targetDir: string,
  appName: string,
  modules?: {
    seo: boolean;
    blogMdx: boolean;
    billing: false | "dodo";
    storage: false | "gcs";
    email?: false | "resend";
    pwa?: boolean;
    jobs: { enabled: boolean; driver: "inngest" | "cron-only" };
    observability: { sentry: boolean; otel: boolean };
  }
) {
  const configPath = path.join(targetDir, "0xstack.config.ts");
  try {
    await fs.access(configPath);
    return;
  } catch {
    // continue
  }

  const initModules = {
    orgs: true,
    billing: modules?.billing ?? false,
    storage: modules?.storage ?? false,
    email: modules?.email ?? false,
    pwa: modules?.pwa ?? false,
    seo: modules?.seo ?? false,
    blogMdx: modules?.blogMdx ?? false,
  };

  const content = `import { defineConfig } from "./lib/0xstack/config";

export default defineConfig({
  app: { name: ${JSON.stringify(appName)}, baseUrl: "http://localhost:3000" },
  modules: {
    // init enables core (auth fixed) + your selected modules.
    orgs: true,
    billing: ${JSON.stringify(initModules.billing)},
    storage: ${JSON.stringify(initModules.storage)},
    pwa: ${JSON.stringify(initModules.pwa)},
    seo: ${JSON.stringify(initModules.seo)},
    blogMdx: ${JSON.stringify(initModules.blogMdx)},
  },
  profiles: {
    core: { modules: { orgs: true, billing: false, storage: false, email: false, pwa: false, seo: false, blogMdx: false } },
    full: { modules: { orgs: true, billing: "dodo", storage: "gcs", email: "resend", pwa: true, seo: true, blogMdx: true, jobs: { enabled: true, driver: "cron-only" } } },
  },
});
`;
  await fs.writeFile(configPath, content, "utf8");
}

export async function loadConfig(projectRoot: string): Promise<MilordConfig> {
  const configPathTs = path.join(projectRoot, "0xstack.config.ts");
  const configPathJs = path.join(projectRoot, "0xstack.config.js");

  let configPath: string | null = null;
  try {
    await fs.access(configPathTs);
    configPath = configPathTs;
  } catch {
    try {
      await fs.access(configPathJs);
      configPath = configPathJs;
    } catch {
      configPath = null;
    }
  }

  if (!configPath) {
    return ConfigSchema.parse({});
  }

  if (configPath.endsWith(".ts")) {
    const { default: jitiFactory } = await import("jiti");
    const jiti = jitiFactory(projectRoot, { interopDefault: true });
    const mod = jiti(configPath);
    const raw = (mod as any)?.default ?? mod;
    return ConfigSchema.parse(raw);
  }

  const mod = await import(pathToFileURL(configPath).href);
  const raw = (mod as any)?.default ?? mod;
  return ConfigSchema.parse(raw);
}

