import chalk from "chalk";

type Level = "info" | "warn" | "error" | "success";

export class Logger {
  info(msg: string) {
    // eslint-disable-next-line no-console
    console.log(chalk.cyan(msg));
  }
  warn(msg: string) {
    // eslint-disable-next-line no-console
    console.warn(chalk.yellow(msg));
  }
  error(msg: string) {
    // eslint-disable-next-line no-console
    console.error(chalk.red(msg));
  }
  success(msg: string) {
    // eslint-disable-next-line no-console
    console.log(chalk.green(msg));
  }

  stepStart(name: string) {
    this.info(`→ ${name}`);
  }

  stepEnd(name: string, ms: number, status: "ok" | "skip") {
    const tag = status === "ok" ? chalk.green("ok") : chalk.gray("skip");
    // eslint-disable-next-line no-console
    console.log(`  ${tag} ${chalk.gray(`(${ms}ms)`)} ${name}`);
  }

  stepFail(name: string, ms: number) {
    // eslint-disable-next-line no-console
    console.error(`  ${chalk.red("fail")} ${chalk.gray(`(${ms}ms)`)} ${name}`);
  }
}

export const logger = new Logger();

