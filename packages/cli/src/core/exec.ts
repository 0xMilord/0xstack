import { execa } from "execa";

export type ExecOptions = {
  cwd: string;
  env?: Readonly<Partial<Record<string, string>>>;
};

export async function execCmd(cmd: string, args: string[], opts: ExecOptions) {
  const execaOpts = {
    cwd: opts.cwd,
    stdio: "inherit",
    ...(opts.env ? { env: opts.env } : {}),
  } as const;

  const child = execa(cmd, args, execaOpts);
  await child;
}

type FileSnapshot = Map<string, { mtimeMs: number; size: number }>;

async function listFilesRecursive(root: string): Promise<string[]> {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const out: string[] = [];
  const walk = async (dir: string) => {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === "node_modules" || e.name === ".next" || e.name === ".git" || e.name === "dist") continue;
        await walk(full);
      } else if (e.isFile()) {
        out.push(full);
      }
    }
  };
  await walk(root);
  return out;
}

export async function snapshotFiles(root: string): Promise<FileSnapshot> {
  const fs = await import("node:fs/promises");
  const snap: FileSnapshot = new Map();
  const files = await listFilesRecursive(root);
  for (const f of files) {
    try {
      const st = await fs.stat(f);
      snap.set(f, { mtimeMs: st.mtimeMs, size: st.size });
    } catch {
      // ignore
    }
  }
  return snap;
}

export function diffSnapshots(before: FileSnapshot, after: FileSnapshot) {
  const changed: string[] = [];
  const added: string[] = [];
  const removed: string[] = [];

  for (const [f] of before) {
    if (!after.has(f)) removed.push(f);
  }
  for (const [f, stAfter] of after) {
    const stBefore = before.get(f);
    if (!stBefore) {
      added.push(f);
      continue;
    }
    if (stBefore.mtimeMs !== stAfter.mtimeMs || stBefore.size !== stAfter.size) changed.push(f);
  }

  return { added, changed, removed };
}

