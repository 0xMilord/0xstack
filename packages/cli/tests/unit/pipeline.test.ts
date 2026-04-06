import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { runPipeline } from "../../src/core/pipeline";

describe("runPipeline", () => {
  it("executes all steps sequentially and returns results", async () => {
    const order: number[] = [];
    const steps = [
      { name: "step1", run: async () => { order.push(1); return { kind: "ok" as const, meta: { value: 1 } }; } },
      { name: "step2", run: async () => { order.push(2); return { kind: "ok" as const, meta: { value: 2 } }; } },
      { name: "step3", run: async () => { order.push(3); return { kind: "ok" as const, meta: { value: 3 } }; } },
    ];
    const results = await runPipeline(steps);
    expect(order).toEqual([1, 2, 3]);
    expect(results).toHaveLength(3);
    expect(results![0]).toEqual({ kind: "ok", meta: { value: 1 } });
    expect(results![1]).toEqual({ kind: "ok", meta: { value: 2 } });
    expect(results![2]).toEqual({ kind: "ok", meta: { value: 3 } });
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
    const results = await runPipeline(steps);
    expect(order).toEqual([1, 2, 3]);
    expect(results).toHaveLength(3);
    expect(results![1]).toEqual({ kind: "skip", reason: "not needed" });
  });

  it("handles empty pipeline by returning undefined", async () => {
    const results = await runPipeline([]);
    expect(results).toBeUndefined();
  });

  it("preserves step result metadata", async () => {
    const steps = [
      { name: "step1", run: async () => ({ kind: "ok" as const, meta: { value: 42, nested: { a: 1 } } }) },
    ];
    const results = await runPipeline(steps);
    expect(results).toHaveLength(1);
    expect(results![0]).toEqual({ kind: "ok", meta: { value: 42, nested: { a: 1 } } });
  });

  it("handles mixed ok, skip, and error results", async () => {
    const steps = [
      { name: "ok", run: async () => ({ kind: "ok" as const }) },
      { name: "skip", run: async () => ({ kind: "skip" as const, reason: "conditional" }) },
      { name: "ok2", run: async () => ({ kind: "ok" as const }) },
    ];
    const results = await runPipeline(steps);
    expect(results).toHaveLength(3);
    expect(results![0].kind).toBe("ok");
    expect(results![1].kind).toBe("skip");
    expect(results![2].kind).toBe("ok");
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
    const results = await runPipeline(steps);
    expect(results).toHaveLength(2);
  });
});
