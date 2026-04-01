import fs from "node:fs/promises";
import path from "node:path";
import { runBaseline } from "../baseline/run-baseline";

export type AddInput = { projectRoot: string; moduleId: string };

export async function runAddModule(input: AddInput) {
  const cfgPath = path.join(input.projectRoot, "0xstack.config.ts");
  const src = await fs.readFile(cfgPath, "utf8");

  const enable = (inSrc: string, key: string, value: string) => {
    const re = new RegExp(`${key}:\\s*[^,\\n]+`, "m");
    if (re.test(inSrc)) return inSrc.replace(re, `${key}: ${value}`);

    // Insert new key inside `modules: { ... }` if missing.
    const modulesBlockRe = /modules:\s*\{\s*([\s\S]*?)\n\s*\},/m;
    const m = inSrc.match(modulesBlockRe);
    if (!m) throw new Error("Cannot find modules: { ... } block in config");
    const inner = m[1] ?? "";
    const nextInner = `${inner.trimEnd()}\n    ${key}: ${value},`;
    return inSrc.replace(modulesBlockRe, (whole) => whole.replace(inner, nextInner));
  };

  let next = src;
  const mod = input.moduleId;
  if (mod === "seo") next = enable(next, "seo", "true");
  else if (mod === "blogMdx") next = enable(next, "blogMdx", "true");
  else if (mod === "billing-dodo" || mod === "billing") next = enable(next, "billing", `"dodo"`);
  else if (mod === "storage-gcs" || mod === "storage") next = enable(next, "storage", `"gcs"`);
  else if (mod === "email-resend" || mod === "email") next = enable(next, "email", `"resend"`);
  else if (mod === "jobs") next = src.replace(/jobs:\s*\{[^}]*\}/m, `jobs: { enabled: true, driver: "cron-only" }`);
  else throw new Error(`Unknown module: ${mod}`);

  await fs.writeFile(cfgPath, next, "utf8");
  await runBaseline({ projectRoot: input.projectRoot, profile: "core", packageManager: "pnpm" });
}

