import { logger } from "./logger";
import ora from "ora";

export type StepResult =
  | { kind: "ok"; meta?: Record<string, unknown> }
  | { kind: "skip"; reason?: string; meta?: Record<string, unknown> };

export type StepContext = {
  readonly now: () => number;
};

export type Step = {
  name: string;
  run: (ctx: StepContext) => Promise<StepResult>;
  retry?: { retries: number; backoffMs?: number; onErrorHint?: string };
};

export async function runPipeline(steps: Step[]) {
  const ctx: StepContext = { now: () => Date.now() };
  const useSpinner = !!process.stdout.isTTY;

  for (const step of steps) {
    const start = Date.now();
    const spinner = useSpinner ? ora(step.name).start() : null;
    if (!useSpinner) logger.stepStart(step.name);

    const retries = Math.max(0, step.retry?.retries ?? 0);
    const backoffMs = Math.max(0, step.retry?.backoffMs ?? 250);

    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        const result = await step.run(ctx);
        const ms = Date.now() - start;
        if (spinner) {
          if (result.kind === "skip") spinner.info(`${step.name} (${ms}ms)`);
          else spinner.succeed(`${step.name} (${ms}ms)`);
        } else {
          logger.stepEnd(step.name, ms, result.kind);
        }
        break;
      } catch (err) {
        if (attempt >= retries) {
          const ms = Date.now() - start;
          if (spinner) spinner.fail(`${step.name} (${ms}ms)`);
          else logger.stepFail(step.name, ms);
          if (step.retry?.onErrorHint) {
            logger.warn(`Hint: ${step.retry.onErrorHint}`);
          }
          throw err;
        }
        attempt += 1;
        logger.warn(`Retrying step (${attempt}/${retries}): ${step.name}`);
        await new Promise((r) => setTimeout(r, backoffMs * attempt));
      }
    }
  }
}

