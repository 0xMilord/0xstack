import type { CAC } from "cac";
import path from "node:path";
import { runGenerateDomain } from "../core/generate/run-generate-domain.js";

export function registerGenerateCommand(cli: CAC) {
  cli
    .command("generate <domain>", "Generate a domain module end-to-end")
    .option("--dir <dir>", "Project directory (default: current)")
    .option("--with-api", "Generate external API routes (app/api/v1/...)")
    .action(async (domain: string, options) => {
      const dir = path.resolve(process.cwd(), options.dir ?? ".");
      await runGenerateDomain({
        projectRoot: dir,
        domain,
        withApi: !!options.withApi,
      });
    });
}

