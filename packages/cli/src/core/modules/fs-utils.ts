import fs from "node:fs/promises";
import path from "node:path";

export async function exists(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true });
}

export async function writeFileEnsured(p: string, content: string) {
  await ensureDir(path.dirname(p));
  await fs.writeFile(p, content, "utf8");
}

export async function backupAndRemove(projectRoot: string, relPath: string) {
  const abs = path.join(projectRoot, relPath);
  if (!(await exists(abs))) return;
  const backupRoot = path.join(projectRoot, ".0xstack", "disabled");
  const backupAbs = path.join(backupRoot, relPath);
  await ensureDir(path.dirname(backupAbs));
  await fs.copyFile(abs, backupAbs);
  await fs.rm(abs, { force: true });
}

