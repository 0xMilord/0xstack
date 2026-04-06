import { describe, it, expect, vi } from "vitest";
import { runPipeline } from "../../src/core/pipeline";

describe("runPipeline", () => {
  it("executes all steps sequentially", async () => {
    const order: number[] = [];
    const steps = [
      { name: "step1", run: async () => { order.push(1); return { kind: "ok" }; } },
      { name: "step2", run: async () => { order.push(2); return { kind: "ok" }; } },
      { name: "step3", run: async () => { order.push(3); return { kind: "ok" }; } },
    ];
    await runPipeline(steps);
    expect(order).toEqual([1, 2, 3]);
  });

  it("stops on first failure", async () => {
    const order: number[] = [];
    const steps = [
      { name: "step1", run: async () => { order.push(1); return { kind: "ok" }; } },
      { name: "step2", run: async () => { throw new Error("boom"); } },
      { name: "step3", run: async () => { order.push(3); return { kind: "ok" }; } },
    ];
    await expect(runPipeline(steps)).rejects.toThrow("boom");
    expect(order).toEqual([1]);
  });

  it("handles skip results without stopping", async () => {
    const order: number[] = [];
    const steps = [
      { name: "step1", run: async () => { order.push(1); return { kind: "ok" }; } },
      { name: "step2", run: async () => { order.push(2); return { kind: "skip", reason: "not needed" }; } },
      { name: "step3", run: async () => { order.push(3); return { kind: "ok" }; } },
    ];
    await runPipeline(steps);
    expect(order).toEqual([1, 2, 3]);
  });

  it("handles empty pipeline", async () => {
    await runPipeline([]);
    // Should not throw
  });

  it("preserves step result metadata", async () => {
    const steps = [
      { name: "step1", run: async () => ({ kind: "ok" as const, meta: { value: 42 } }) },
    ];
    const results = await runPipeline(steps);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ kind: "ok", meta: { value: 42 } });
  });
});
