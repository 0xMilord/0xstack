import type { CAC } from "cac";
import path from "node:path";
import { runDoctor } from "../core/doctor/run-doctor";

export function registerDoctorCommand(cli: CAC) {
  cli
    .command("doctor", "Validate env, deps, and architecture constraints")
    .option("--dir <dir>", "Project directory (default: current)")
    .option("--profile <profile>", "Profile to validate against (default: minimal)")
    .action(async (options) => {
      const dir = path.resolve(process.cwd(), options.dir ?? ".");
      const profile = options.profile ?? "minimal";
      await runDoctor({ projectRoot: dir, profile });
    });
}

