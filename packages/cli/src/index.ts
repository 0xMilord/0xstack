#!/usr/bin/env node
import { cac } from "cac";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerInitCommand } from "./commands/init";
import { registerWrapperCommands } from "./commands/wrappers";
import { registerBaselineCommand } from "./commands/baseline";
import { registerDoctorCommand } from "./commands/doctor";
import { registerSyncCommand } from "./commands/sync";
import { registerDocsSyncCommand } from "./commands/docs-sync";
import { registerGenerateCommand } from "./commands/generate";
import { registerAddCommand } from "./commands/add";
import { registerGitCommands } from "./commands/git";
import { registerReleaseCommand } from "./commands/release";
import { registerUpgradeCommand } from "./commands/upgrade";

const cli = cac("0xstack");

cli.help();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkgPath = path.join(__dirname, "..", "package.json");
const version = (() => {
  try {
    const raw = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as { version?: string };
    return raw.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
})();
cli.version(version);

registerInitCommand(cli);
registerWrapperCommands(cli);
registerBaselineCommand(cli);
registerDoctorCommand(cli);
registerSyncCommand(cli);
registerDocsSyncCommand(cli);
registerGenerateCommand(cli);
registerAddCommand(cli);
registerGitCommands(cli);
registerReleaseCommand(cli);
registerUpgradeCommand(cli);

try {
  cli.parse();
} catch (err) {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
}

