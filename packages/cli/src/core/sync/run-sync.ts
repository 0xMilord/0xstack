import { runPipeline } from "../pipeline";
import { runDocsSync } from "../docs/run-docs-sync";
import { runBaseline } from "../baseline/run-baseline";

export type SyncInput = { projectRoot: string; profile: string };

export async function runSync(input: SyncInput) {
  await runPipeline([
    {
      name: "baseline (reconcile deps/files)",
      run: async () => {
        await runBaseline({ projectRoot: input.projectRoot, profile: input.profile, packageManager: "pnpm" });
        return { kind: "ok" };
      },
    },
    {
      name: "docs sync",
      run: async () => {
        await runDocsSync({ projectRoot: input.projectRoot });
        return { kind: "ok" };
      },
    },
  ]);
}

