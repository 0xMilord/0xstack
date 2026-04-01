import type { CAC } from "cac";
import fs from "node:fs/promises";
import path from "node:path";
import prompts from "prompts";
import { execCmd } from "../core/exec";
import { logger } from "../core/logger";

export function registerGitCommands(cli: CAC) {
  cli
    .command("git init", "Initialize git repo")
    .option("--dir <dir>", "Project directory (default: current)")
    .action(async (options: any) => {
      const dir = path.resolve(process.cwd(), options.dir ?? ".");
      logger.info(`Running: git init (cwd=${dir})`);
      await execCmd("git", ["init"], { cwd: dir });
      logger.info("Done.");
    });

  cli
    .command("git status", "Show git status")
    .option("--dir <dir>", "Project directory (default: current)")
    .action(async (options: any) => {
      const dir = path.resolve(process.cwd(), options.dir ?? ".");
      logger.info(`Running: git status (cwd=${dir})`);
      await execCmd("git", ["status"], { cwd: dir });
    });

  cli
    .command("git commit", "Prompted conventional commit (feat/fix/chore/refactor + scope)")
    .option("--dir <dir>", "Project directory (default: current)")
    .option("-m, --message <message>", "Skip prompts; full message (e.g. feat(auth): add OAuth)")
    .action(async (options: any) => {
      const dir = path.resolve(process.cwd(), options.dir ?? ".");
      let message = typeof options.message === "string" ? options.message.trim() : "";

      if (!message) {
        const r = await prompts(
          [
            {
              type: "select",
              name: "type",
              message: "Commit type",
              choices: [
                { title: "feat", value: "feat" },
                { title: "fix", value: "fix" },
                { title: "chore", value: "chore" },
                { title: "refactor", value: "refactor" },
                { title: "docs", value: "docs" },
                { title: "test", value: "test" },
              ],
              initial: 0,
            },
            {
              type: "text",
              name: "scope",
              message: "Scope (orgs, billing, auth, cli, …) or leave empty",
              initial: "",
            },
            {
              type: "text",
              name: "subject",
              message: "Short description",
              validate: (s: string) => (s.trim().length ? true : "Required"),
            },
          ],
          { onCancel: () => process.exit(1) }
        );
        const scope = String(r.scope ?? "").trim();
        message = scope ? `${r.type}(${scope}): ${String(r.subject).trim()}` : `${r.type}: ${String(r.subject).trim()}`;
      }

      try {
        await fs.access(path.join(dir, ".git"));
      } catch {
        throw new Error(`No .git in ${dir}. Run \`0xstack git init\` first.`);
      }

      logger.info(`Running: git commit -m ${JSON.stringify(message)} (cwd=${dir})`);
      await execCmd("git", ["commit", "-m", message], { cwd: dir });
      logger.success("Commit created.");
    });
}

