import fs from "node:fs/promises";
import path from "node:path";
import type { MilordConfig } from "./config";

/**
 * Older configs may omit `observability` / `jobs`. Insert before the closing `},` of `modules`.
 */
export async function ensureObservabilityAndJobsKeys(projectRoot: string) {
  const p = path.join(projectRoot, "0xstack.config.ts");
  let src = await fs.readFile(p, "utf8");
  if (/\bjobs:\s*\{/m.test(src) && /\bobservability:\s*\{/m.test(src)) return;

  if (!/\bobservability:\s*\{/m.test(src)) {
    if (/\blogMdx:\s*[^\n]+\n/.test(src)) {
      src = src.replace(/(\blogMdx:\s*[^\n]+\n)/, `$1    observability: { sentry: false },\n`);
    }
  }
  if (!/\bjobs:\s*\{/m.test(src)) {
    src = src.replace(/(observability:\s*\{[^}]+\},?\n)/, `$1    jobs: { enabled: false, driver: "cron-only" },\n`);
  }
  await fs.writeFile(p, src, "utf8");
}

export type PatchableModules = Partial<
  Pick<
    MilordConfig["modules"],
    "seo" | "blogMdx" | "billing" | "storage" | "email" | "cache" | "pwa" | "jobs" | "observability"
  >
>;

function replaceKey(src: string, key: string, valueExpr: string): string {
  const re = new RegExp(`(\\b${key}:\\s*)([^\\n]+)`, "m");
  if (!re.test(src)) throw new Error(`Could not find ${key}: in 0xstack.config.ts`);
  return src.replace(re, `$1${valueExpr}`);
}

/**
 * Update `modules` fields in 0xstack.config.ts (best-effort, preserves formatting loosely).
 */
export async function patchConfigModules(projectRoot: string, patch: PatchableModules) {
  const p = path.join(projectRoot, "0xstack.config.ts");
  let src = await fs.readFile(p, "utf8");

  if (patch.seo !== undefined) src = replaceKey(src, "seo", String(patch.seo));
  if (patch.blogMdx !== undefined) src = replaceKey(src, "blogMdx", String(patch.blogMdx));
  if (patch.billing !== undefined) src = replaceKey(src, "billing", JSON.stringify(patch.billing));
  if (patch.storage !== undefined) src = replaceKey(src, "storage", JSON.stringify(patch.storage));
  if (patch.email !== undefined) src = replaceKey(src, "email", JSON.stringify(patch.email));
  if (patch.cache !== undefined) src = replaceKey(src, "cache", String(patch.cache));
  if (patch.pwa !== undefined) src = replaceKey(src, "pwa", String(patch.pwa));

  if (patch.jobs !== undefined) {
    const expr = `{ enabled: ${patch.jobs.enabled}, driver: ${JSON.stringify(patch.jobs.driver)} }`;
    const re = /(\bjobs:\s*)\{[^}]+\}/m;
    if (!re.test(src)) throw new Error("Could not find jobs: { ... } in 0xstack.config.ts");
    src = src.replace(re, `$1${expr}`);
  }

  if (patch.observability !== undefined) {
    const expr = `{ sentry: ${patch.observability.sentry} }`;
    const re = /(\bobservability:\s*)\{[^}]+\}/m;
    if (!re.test(src)) throw new Error("Could not find observability: { ... } in 0xstack.config.ts");
    src = src.replace(re, `$1${expr}`);
  }

  await fs.writeFile(p, src, "utf8");
}
