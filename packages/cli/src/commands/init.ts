import type { CAC } from "cac";
import path from "node:path";
import { runInit, type InitInput } from "../core/init/run-init";
import { promptInitDefaults } from "../core/interactive/prompt-init";

function parseBillingFlag(v: unknown): false | "dodo" | "stripe" {
  if (v === undefined || v === null || v === "") return false;
  const s = String(v).toLowerCase();
  if (s === "none" || s === "false" || s === "off") return false;
  if (s === "dodo") return "dodo";
  if (s === "stripe") return "stripe";
  throw new Error(`Invalid --billing: ${String(v)} (use none|dodo|stripe)`);
}

function parseStorageFlag(v: unknown): false | "gcs" | "s3" | "supabase" {
  if (v === undefined || v === null || v === "") return false;
  const s = String(v).toLowerCase();
  if (s === "none" || s === "false" || s === "off") return false;
  if (s === "gcs") return "gcs";
  if (s === "s3") return "s3";
  if (s === "supabase") return "supabase";
  throw new Error(`Invalid --storage: ${String(v)} (use none|gcs|s3|supabase)`);
}

function buildPresetFeatures(options: {
  yes?: boolean;
  billing?: string;
  storage?: string;
  seo?: boolean;
  blog?: boolean;
  email?: boolean;
  pwa?: boolean;
  jobs?: boolean;
  sentry?: boolean;
  otel?: boolean;
  noCache?: boolean;
}): InitInput["features"] | undefined {
  const hasExplicit =
    options.billing !== undefined ||
    options.storage !== undefined ||
    options.seo ||
    options.blog ||
    options.email ||
    options.pwa ||
    options.jobs ||
    options.sentry ||
    options.otel ||
    options.noCache;

  if (!options.yes && !hasExplicit) return undefined;

  return {
    seo: !!options.seo,
    blogMdx: !!options.blog,
    billing: options.billing !== undefined ? parseBillingFlag(options.billing) : false,
    storage: options.storage !== undefined ? parseStorageFlag(options.storage) : false,
    email: options.email ? "resend" : false,
    cache: options.noCache ? false : true,
    pwa: !!options.pwa,
    jobs: { enabled: !!options.jobs, driver: "cron-only" },
    observability: { sentry: !!options.sentry, otel: !!options.otel },
  };
}

export function registerInitCommand(cli: CAC) {
  cli
    .command("init", "Initialize a new 0xstack app (progressive TUI when interactive)")
    .option("--dir <dir>", "Target directory (default: current)")
    .option("--name <name>", "Project name (default: folder name)")
    .option("--pm <pm>", "Package manager: pnpm|npm (default: pnpm)")
    .option("--theme <theme>", "Theme: default|corporate-blue|amber|grass (default: default)")
    .option("--billing <provider>", "Billing: none|dodo|stripe (with --yes or other module flags)")
    .option("--storage <provider>", "Storage: none|gcs|s3|supabase (with --yes or other module flags)")
    .option("--seo", "Enable SEO module")
    .option("--blog", "Enable MDX blog module")
    .option("--email", "Enable Resend email module")
    .option("--pwa", "Enable PWA module")
    .option("--jobs", "Enable jobs module (cron-only stub)")
    .option("--sentry", "Enable Sentry flag in config")
    .option("--otel", "Enable OpenTelemetry flag in config")
    .option("--no-cache", "Disable cache module in config (with --yes)")
    .option("--yes", "Skip prompts (CI-friendly); combine with module flags above")
    .option("--interactive", "Force prompts even in non-TTY")
    .action(async (options) => {
      const cwd = process.cwd();
      const pm = options.pm ?? "pnpm";

      const shouldPrompt =
        !options.yes && (options.interactive || process.stdout.isTTY) && !options.dir && !options.name;
      if (shouldPrompt) {
        const answers = await promptInitDefaults(cwd);
        await runInit({
          dir: answers.dir,
          name: answers.name,
          packageManager: answers.packageManager,
          theme: answers.theme,
          features: answers.modules,
        });
        return;
      }

      const dir = path.resolve(cwd, options.dir ?? ".");
      const name = options.name ?? path.basename(dir);
      const features = buildPresetFeatures(options);
      await runInit({
        dir,
        name,
        packageManager: pm === "npm" ? "npm" : "pnpm",
        theme:
          options.theme === "corporate-blue" || options.theme === "amber" || options.theme === "grass"
            ? options.theme
            : "default",
        ...(features ? { features } : {}),
      });
    });
}
