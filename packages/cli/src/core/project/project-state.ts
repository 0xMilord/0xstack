import fs from "node:fs/promises";
import path from "node:path";
import { loadConfig, applyProfile } from "../config";

async function exists(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export type ProjectState = {
  projectRoot: string;
  config: any;
  appliedProfile: string;
  modules: Record<string, unknown>;
  routes: Array<{ path: string; kind: "api" | "page" }>;
};

async function listRoutes(appDir: string): Promise<ProjectState["routes"]> {
  const out: ProjectState["routes"] = [];
  const walk = async (dir: string) => {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        await walk(full);
        continue;
      }
      if (e.isFile() && (e.name === "page.tsx" || e.name === "route.ts")) {
        const rel = full.replace(appDir, "").replaceAll("\\", "/");
        out.push({ path: `/app${rel}`, kind: e.name === "route.ts" ? "api" : "page" });
      }
    }
  };
  await walk(appDir);
  return out;
}

export async function computeProjectState(projectRoot: string, profile: string): Promise<ProjectState> {
  const config = applyProfile(await loadConfig(projectRoot), profile);
  const appDir = path.join(projectRoot, "app");
  if (!(await exists(appDir))) throw new Error("Missing app/ directory");
  return {
    projectRoot,
    config,
    appliedProfile: profile,
    modules: config.modules,
    routes: await listRoutes(appDir),
  };
}

