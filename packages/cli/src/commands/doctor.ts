import type { CAC } from "cac";
import path from "node:path";
import { runDoctor } from "../core/doctor/run-doctor";

export function registerDoctorCommand(cli: CAC) {
  cli
    .command("doctor", "Validate env, deps, and architecture constraints")
    .option("--dir <dir>", "Project directory (default: current)")
    .option("--profile <profile>", "Profile preset to validate against (default: core)")
    .option("--strict", "Fail on PRD hygiene too (generated-domain tests, ESLint boundary files, module factories)")
    .action(async (options) => {
      const dir = path.resolve(process.cwd(), options.dir ?? ".");
      const profile = options.profile ?? "core";
      const strict = !!options.strict;
      const result = await runDoctor({ projectRoot: dir, profile, strict });
      const failStrict = strict && result.issues.length + result.strictOnly.length > 0;
      if (result.criticalCount > 0 || failStrict) {
        throw new Error(
          `doctor failed (${profile}): ${result.criticalCount} critical, ${result.warningCount} warnings, ${result.infoCount} info`
        );
      }
    });
}

