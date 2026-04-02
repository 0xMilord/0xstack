import prompts from "prompts";
import path from "node:path";
import chalk from "chalk";

export type InitAnswers = {
  locationMode: "new-dir" | "current-dir";
  dir: string;
  name: string;
  description: string;
  packageManager: "pnpm" | "npm";
  theme: "default" | "corporate-blue" | "amber" | "grass";
  modules: {
    seo: boolean;
    blogMdx: boolean;
    billing: false | "dodo" | "stripe";
    storage: false | "gcs" | "s3" | "supabase";
    email: false | "resend";
    cache: boolean;
    pwa: boolean;
    jobs: { enabled: boolean; driver: "inngest" | "cron-only" };
    observability: { sentry: boolean; otel: boolean };
  };
};

export type WizardDefaults = Partial<InitAnswers["modules"]> & {
  /** Pre-select package manager when reconfiguring */
  packageManager?: "pnpm" | "npm";
  theme?: InitAnswers["theme"];
};

function section(title: string, hint?: string) {
  // eslint-disable-next-line no-console
  console.log("\n" + chalk.bold.cyan(`▸ ${title}`));
  if (hint) {
    // eslint-disable-next-line no-console
    console.log(chalk.dim(hint));
  }
}

const onCancel = () => {
  throw new Error("Setup cancelled.");
};

/**
 * Progressive TUI: one concern per step (init — new project).
 */
export async function runProgressiveInitWizard(cwd: string): Promise<InitAnswers> {
  // eslint-disable-next-line no-console
  console.log(chalk.bold("\n0xstack — new project setup\n") + chalk.dim("Auth + orgs are always included. Enable optional modules below.\n"));

  section("1 · Location", "Where should the app live?");
  const loc = await prompts(
    {
      type: "select",
      name: "locationMode",
      message: "Project location",
      choices: [
        { title: "Create a new folder (recommended)", value: "new-dir" },
        { title: "Use the current directory", value: "current-dir" },
      ],
      initial: 0,
    },
    { onCancel }
  );

  let dirName = "my-app";
  if (loc.locationMode === "new-dir") {
    const dn = await prompts(
      {
        type: "text",
        name: "dirName",
        message: "New folder name",
        initial: "my-app",
        validate: (v: string) => (v?.trim() ? true : "Folder name is required"),
      },
      { onCancel }
    );
    dirName = String(dn.dirName).trim();
  }

  const mode = loc.locationMode as "new-dir" | "current-dir";
  const dir = mode === "current-dir" ? cwd : path.join(cwd, dirName);

  section("2 · Identity");
  const id = await prompts(
    {
      type: "text",
      name: "name",
      message: "App display name",
      initial: mode === "new-dir" ? dirName : path.basename(cwd),
      validate: (v: string) => (v?.trim() ? true : "Name is required"),
    },
    { onCancel }
  );

  const desc = await prompts(
    {
      type: "text",
      name: "description",
      message: "Brief description (for SEO & hero section)",
      initial: "Production-ready Next.js starter",
      validate: (v: string) => (v?.trim() ? true : "Description is required"),
    },
    { onCancel }
  );

  section("3 · Tooling");
  const tool = await prompts(
    {
      type: "select",
      name: "packageManager",
      message: "Package manager",
      choices: [
        { title: "pnpm (recommended)", value: "pnpm" },
        { title: "npm", value: "npm" },
      ],
      initial: 0,
    },
    { onCancel }
  );

  const themeAns = await prompts(
    {
      type: "select",
      name: "theme",
      message: "Theme (globals.css tokens)",
      choices: [
        { title: "Default (0xstack)", value: "default" },
        { title: "Corporate Blue", value: "corporate-blue" },
        { title: "Amber", value: "amber" },
        { title: "Grass", value: "grass" },
      ],
      initial: 0,
    },
    { onCancel }
  );

  section("4 · Content & marketing", "SEO and blog are optional but work well together.");
  const seo = await prompts(
    {
      type: "confirm",
      name: "v",
      message: "Enable SEO (robots, sitemap, JSON-LD, OG/Twitter)?",
      initial: false,
    },
    { onCancel }
  );
  const blog = await prompts(
    {
      type: "confirm",
      name: "v",
      message: "Enable MDX blog + RSS?",
      initial: false,
    },
    { onCancel }
  );

  section("5 · Billing", "Checkout + portal + webhooks stay off until you pick a provider.");
  const billing = await prompts(
    {
      type: "select",
      name: "provider",
      message: "Billing provider",
      choices: [
        { title: "None", value: "none" },
        { title: "Dodo Payments", value: "dodo" },
        { title: "Stripe", value: "stripe" },
      ],
      initial: 0,
    },
    { onCancel }
  );

  section("6 · Object storage", "Signed uploads for user-generated files.");
  const storage = await prompts(
    {
      type: "select",
      name: "provider",
      message: "Storage provider",
      choices: [
        { title: "None", value: "none" },
        { title: "Google Cloud Storage", value: "gcs" },
        { title: "Amazon S3 (presigned URLs)", value: "s3" },
        { title: "Supabase Storage", value: "supabase" },
      ],
      initial: 0,
    },
    { onCancel }
  );

  section("7 · Email");
  const email = await prompts(
    {
      type: "confirm",
      name: "v",
      message: "Enable Resend (auth email templates)?",
      initial: false,
    },
    { onCancel }
  );

  section("8 · Platform");
  const cache = await prompts(
    {
      type: "confirm",
      name: "v",
      message: "Enable cache layer (L1 LRU + Data Cache + tag revalidation)?",
      initial: true,
    },
    { onCancel }
  );
  const pwa = await prompts(
    {
      type: "confirm",
      name: "v",
      message: "Enable installable PWA (manifest, SW, push scaffolding)?",
      initial: false,
    },
    { onCancel }
  );
  const jobs = await prompts(
    {
      type: "confirm",
      name: "v",
      message: "Enable jobs module (cron-only HTTP reconcile stub)?",
      initial: false,
    },
    { onCancel }
  );

  section("9 · Observability");
  const sentry = await prompts(
    {
      type: "confirm",
      name: "v",
      message: "Enable Sentry (requires env + follow-up setup)?",
      initial: false,
    },
    { onCancel }
  );
  const otel = await prompts(
    {
      type: "confirm",
      name: "v",
      message: "Enable OpenTelemetry scaffolding?",
      initial: false,
    },
    { onCancel }
  );

  const bp = billing.provider as string;
  const sp = storage.provider as string;

  const summary =
    `\n${chalk.bold("Summary")}\n` +
    `  ${chalk.dim("Location:")} ${dir}\n` +
    `  ${chalk.dim("Name:")} ${String(id.name).trim()}\n` +
    `  ${chalk.dim("Description:")} ${String(desc.description).trim()}\n` +
    `  ${chalk.dim("PM:")} ${tool.packageManager}\n` +
    `  ${chalk.dim("Modules:")} SEO=${seo.v} Blog=${blog.v} Billing=${bp} Storage=${sp} Email=${email.v}\n` +
    `  ${chalk.dim("Platform:")} cache=${cache.v} pwa=${pwa.v} jobs=${jobs.v}\n` +
    `  ${chalk.dim("Observability:")} sentry=${sentry.v} otel=${otel.v}\n`;

  // eslint-disable-next-line no-console
  console.log(summary);

  const ok = await prompts(
    {
      type: "confirm",
      name: "v",
      message: "Create project with these settings?",
      initial: true,
    },
    { onCancel }
  );
  if (!ok.v) throw new Error("Setup cancelled.");

  return {
    locationMode: mode,
    dir,
    name: String(id.name).trim(),
    description: String(desc.description).trim(),
    packageManager: tool.packageManager === "npm" ? "npm" : "pnpm",
    theme:
      themeAns.theme === "corporate-blue" || themeAns.theme === "amber" || themeAns.theme === "grass"
        ? themeAns.theme
        : "default",
    modules: {
      seo: !!seo.v,
      blogMdx: !!blog.v,
      billing: bp === "dodo" || bp === "stripe" ? bp : false,
      storage: sp === "gcs" || sp === "s3" || sp === "supabase" ? sp : false,
      email: email.v ? "resend" : false,
      cache: !!cache.v,
      pwa: !!pwa.v,
      jobs: { enabled: !!jobs.v, driver: "cron-only" },
      observability: { sentry: !!sentry.v, otel: !!otel.v },
    },
  };
}

/**
 * Reconfigure modules for an existing repo (updates 0xstack.config.ts only).
 */
export async function runProgressiveReconfigureWizard(defaults: WizardDefaults): Promise<InitAnswers["modules"]> {
  // eslint-disable-next-line no-console
  console.log(chalk.bold("\n0xstack — reconfigure modules\n") + chalk.dim("Updates your config file. Run `baseline` or `sync --apply` afterward.\n"));

  section("Billing");
  const billing = await prompts(
    {
      type: "select",
      name: "provider",
      message: "Billing provider",
      choices: [
        { title: "None", value: "none" },
        { title: "Dodo Payments", value: "dodo" },
        { title: "Stripe", value: "stripe" },
      ],
      initial:
        defaults.billing === "dodo" ? 1 : defaults.billing === "stripe" ? 2 : 0,
    },
    { onCancel }
  );

  section("Storage");
  const storage = await prompts(
    {
      type: "select",
      name: "provider",
      message: "Storage provider",
      choices: [
        { title: "None", value: "none" },
        { title: "Google Cloud Storage", value: "gcs" },
        { title: "Amazon S3", value: "s3" },
        { title: "Supabase Storage", value: "supabase" },
      ],
      initial:
        defaults.storage === "gcs"
          ? 1
          : defaults.storage === "s3"
            ? 2
            : defaults.storage === "supabase"
              ? 3
              : 0,
    },
    { onCancel }
  );

  section("Content & email");
  const seo = await prompts(
    {
      type: "confirm",
      name: "v",
      message: "SEO module?",
      initial: defaults.seo ?? false,
    },
    { onCancel }
  );
  const blog = await prompts(
    {
      type: "confirm",
      name: "v",
      message: "MDX blog?",
      initial: defaults.blogMdx ?? false,
    },
    { onCancel }
  );
  const email = await prompts(
    {
      type: "confirm",
      name: "v",
      message: "Resend email?",
      initial: defaults.email === "resend",
    },
    { onCancel }
  );

  section("Platform");
  const cache = await prompts(
    {
      type: "confirm",
      name: "v",
      message: "Cache module?",
      initial: defaults.cache !== false,
    },
    { onCancel }
  );
  const pwa = await prompts(
    {
      type: "confirm",
      name: "v",
      message: "PWA module?",
      initial: defaults.pwa ?? false,
    },
    { onCancel }
  );
  const jobs = await prompts(
    {
      type: "confirm",
      name: "v",
      message: "Jobs module?",
      initial: defaults.jobs?.enabled ?? false,
    },
    { onCancel }
  );

  section("Observability");
  const sentry = await prompts(
    {
      type: "confirm",
      name: "v",
      message: "Sentry?",
      initial: defaults.observability?.sentry ?? false,
    },
    { onCancel }
  );
  const otel = await prompts(
    {
      type: "confirm",
      name: "v",
      message: "OpenTelemetry?",
      initial: defaults.observability?.otel ?? false,
    },
    { onCancel }
  );

  const bp = billing.provider as string;
  const sp = storage.provider as string;

  return {
    seo: !!seo.v,
    blogMdx: !!blog.v,
    billing: bp === "dodo" || bp === "stripe" ? bp : false,
    storage: sp === "gcs" || sp === "s3" || sp === "supabase" ? sp : false,
    email: email.v ? "resend" : false,
    cache: !!cache.v,
    pwa: !!pwa.v,
    jobs: { enabled: !!jobs.v, driver: defaults.jobs?.driver ?? "cron-only" },
    observability: { sentry: !!sentry.v, otel: !!otel.v },
  };
}

/** @deprecated Use runProgressiveInitWizard */
export async function promptInitDefaults(cwd: string): Promise<InitAnswers> {
  return runProgressiveInitWizard(cwd);
}
