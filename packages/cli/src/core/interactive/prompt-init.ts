import prompts from "prompts";
import path from "node:path";

export type InitAnswers = {
  locationMode: "new-dir" | "current-dir";
  dir: string;
  name: string;
  packageManager: "pnpm" | "npm";
  modules: {
    seo: boolean;
    blogMdx: boolean;
    billing: false | "dodo";
    storage: false | "gcs";
    email: false | "resend";
    jobs: { enabled: boolean; driver: "inngest" | "cron-only" };
    observability: { sentry: boolean; otel: boolean };
  };
};

export async function promptInitDefaults(cwd: string): Promise<InitAnswers> {
  const response = await prompts(
    [
      {
        type: "select",
        name: "locationMode",
        message: "Where should 0xmilord initialize the app?",
        choices: [
          { title: "Create a new folder", value: "new-dir" },
          { title: "Use the current directory", value: "current-dir" },
        ],
        initial: 0,
      },
      {
        type: (prev: string) => (prev === "new-dir" ? "text" : null),
        name: "dirName",
        message: "Folder name",
        initial: "my-app",
        validate: (v: string) => (v?.trim() ? true : "Folder name is required"),
      },
      {
        type: "text",
        name: "name",
        message: "App name",
        initial: (_: unknown, values: any) =>
          typeof values?.dirName === "string" && values.dirName.trim()
            ? values.dirName.trim()
            : path.basename(cwd),
        validate: (v: string) => (v?.trim() ? true : "App name is required"),
      },
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
      {
        type: "multiselect",
        name: "modulesOn",
        message: "Enable modules (core auth + orgs are always on)",
        choices: [
          { title: "SEO (robots, sitemap, JSON-LD, OG/Twitter)", value: "seo" },
          { title: "Blog (MDX + RSS)", value: "blogMdx" },
          { title: "Billing (Dodo)", value: "billing" },
          { title: "Storage (GCS signed URLs)", value: "storage" },
          { title: "Email (Resend + templates)", value: "email" },
          { title: "Jobs (cron-only endpoints)", value: "jobs" },
          { title: "Observability: Sentry", value: "sentry" },
          { title: "Observability: OpenTelemetry", value: "otel" },
        ],
        initial: 0,
      },
    ],
    {
      onCancel: () => {
        throw new Error("Cancelled.");
      },
    }
  );

  const mode = response.locationMode as "new-dir" | "current-dir";
  const dir =
    mode === "current-dir" ? cwd : path.join(cwd, String(response.dirName).trim());

  const enabled = new Set<string>((response.modulesOn as string[]) ?? []);

  return {
    locationMode: mode,
    dir,
    name: String(response.name).trim(),
    packageManager: response.packageManager === "npm" ? "npm" : "pnpm",
    modules: {
      seo: enabled.has("seo"),
      blogMdx: enabled.has("blogMdx"),
      billing: enabled.has("billing") ? "dodo" : false,
      storage: enabled.has("storage") ? "gcs" : false,
      email: enabled.has("email") ? "resend" : false,
      jobs: { enabled: enabled.has("jobs"), driver: "cron-only" },
      observability: { sentry: enabled.has("sentry"), otel: enabled.has("otel") },
    },
  };
}

