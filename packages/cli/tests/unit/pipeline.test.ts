import { describe, it, expect, vi } from "vitest";
import { runPipeline } from "../../src/core/pipeline";

describe("runPipeline", () => {
  it("executes all steps sequentially", async () => {
    const order: number[] = [];
    const steps = [
      { name: "step1", run: async () => { order.push(1); return { kind: "ok" as const }; } },
      { name: "step2", run: async () => { order.push(2); return { kind: "ok" as const }; } },
      { name: "step3", run: async () => { order.push(3); return { kind: "ok" as const }; } },
    ];
    await runPipeline(steps);
    expect(order).toEqual([1, 2, 3]);
  });

  it("stops on first failure and throws error", async () => {
    const order: number[] = [];
    const steps = [
      { name: "step1", run: async () => { order.push(1); return { kind: "ok" as const }; } },
      { name: "step2", run: async () => { order.push(2); throw new Error("boom"); } },
      { name: "step3", run: async () => { order.push(3); return { kind: "ok" as const }; } },
    ];
    await expect(runPipeline(steps)).rejects.toThrow("boom");
    expect(order).toEqual([1, 2]);
  });

  it("handles skip results without stopping", async () => {
    const order: number[] = [];
    const steps = [
      { name: "step1", run: async () => { order.push(1); return { kind: "ok" as const }; } },
      { name: "step2", run: async () => { order.push(2); return { kind: "skip" as const, reason: "not needed" }; } },
      { name: "step3", run: async () => { order.push(3); return { kind: "ok" as const }; } },
    ];
    await runPipeline(steps);
    expect(order).toEqual([1, 2, 3]);
  });

  it("handles empty pipeline by returning undefined", async () => {
    const results = await runPipeline([]);
    expect(results).toBeUndefined();
  });

  it("handles mixed ok and skip results", async () => {
    const steps = [
      { name: "ok", run: async () => ({ kind: "ok" as const }) },
      { name: "skip", run: async () => ({ kind: "skip" as const, reason: "conditional" }) },
      { name: "ok2", run: async () => ({ kind: "ok" as const }) },
    ];
    // runPipeline completes without throwing
    await expect(runPipeline(steps)).resolves.not.toThrow();
  });

  it("throws with original error message", async () => {
    const steps = [
      { name: "fail", run: async () => { throw new TypeError("type mismatch"); } },
    ];
    await expect(runPipeline(steps)).rejects.toThrow(TypeError);
    await expect(runPipeline(steps)).rejects.toThrow("type mismatch");
  });

  it("handles async steps correctly", async () => {
    const steps = [
      { name: "async1", run: async () => { await new Promise(r => setTimeout(r, 10)); return { kind: "ok" as const }; } },
      { name: "async2", run: async () => { await new Promise(r => setTimeout(r, 5)); return { kind: "ok" as const }; } },
    ];
    await expect(runPipeline(steps)).resolves.not.toThrow();
  });
});
