#!/usr/bin/env node
import { cac } from "cac";
import { registerInitCommand } from "./commands/init";
import { registerWrapperCommands } from "./commands/wrappers";
import { registerBaselineCommand } from "./commands/baseline";
import { registerDoctorCommand } from "./commands/doctor";
import { registerSyncCommand } from "./commands/sync";
import { registerDocsSyncCommand } from "./commands/docs-sync";
import { registerGenerateCommand } from "./commands/generate";
import { registerAddCommand } from "./commands/add";

const cli = cac("0xstack");

cli.help();
cli.version("0.0.0");

registerInitCommand(cli);
registerWrapperCommands(cli);
registerBaselineCommand(cli);
registerDoctorCommand(cli);
registerSyncCommand(cli);
registerDocsSyncCommand(cli);
registerGenerateCommand(cli);
registerAddCommand(cli);

try {
  cli.parse();
} catch (err) {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
}

