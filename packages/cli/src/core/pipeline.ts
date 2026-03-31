import { logger } from "./logger";

export type StepResult =
  | { kind: "ok"; meta?: Record<string, unknown> }
  | { kind: "skip"; reason?: string; meta?: Record<string, unknown> };

export type StepContext = {
  readonly now: () => number;
};

export type Step = {
  name: string;
  run: (ctx: StepContext) => Promise<StepResult>;
};

export async function runPipeline(steps: Step[]) {
  const ctx: StepContext = { now: () => Date.now() };

  for (const step of steps) {
    const start = Date.now();
    logger.stepStart(step.name);
    try {
      const result = await step.run(ctx);
      const ms = Date.now() - start;
      logger.stepEnd(step.name, ms, result.kind);
    } catch (err) {
      const ms = Date.now() - start;
      logger.stepFail(step.name, ms);
      throw err;
    }
  }
}

