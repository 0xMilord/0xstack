import fs from "node:fs/promises";
import path from "node:path";

export type PackageManager = "pnpm" | "npm";

export async function detectPackageManager(projectRoot: string): Promise<PackageManager> {
  try {
    await fs.access(path.join(projectRoot, "pnpm-lock.yaml"));
    return "pnpm";
  } catch {
    // ignore
  }
  try {
    await fs.access(path.join(projectRoot, "package-lock.json"));
    return "npm";
  } catch {
    // ignore
  }
  return "pnpm";
}

export function pmExec(pm: PackageManager): { cmd: string; execArgs: string[] } {
  if (pm === "npm") return { cmd: "npm", execArgs: ["exec", "--"] };
  return { cmd: "pnpm", execArgs: ["exec"] };
}

export function pmDlx(pm: PackageManager): { cmd: string; dlxArgs: string[] } {
  if (pm === "npm") return { cmd: "npx", dlxArgs: [] };
  return { cmd: "pnpm", dlxArgs: ["dlx"] };
}

