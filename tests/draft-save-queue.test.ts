import { describe, expect, it } from "vitest";
import { DraftSaveQueue } from "@/lib/forms/draft-save-queue";
describe("builder save queue", () => {
  it("serializes saves, keeps newer edits, and flush waits for all writes", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const calls: [string, number][] = [];
    const queue = new DraftSaveQueue("initial", 1, async (value, revision) => { calls.push([value, revision]); if (calls.length === 1) await gate; return { ok: true, revision: revision + 1, value }; }, () => undefined);
    queue.edit("first"); const first = queue.flush(); queue.edit("newer"); const second = queue.flush();
    expect(second).toBe(first); expect(calls).toEqual([["first", 1]]); release(); await first;
    expect(calls).toEqual([["first", 1], ["newer", 2]]); expect(queue.value).toBe("newer"); expect(queue.state).toBe("saved");
  });
  it("retains edits on network failure and retries", async () => {
    let fail = true;
    const queue = new DraftSaveQueue("initial", 1, async (value) => { if (fail) throw new Error("Offline"); return { ok: true, value, revision: 2 }; }, () => undefined);
    queue.edit("mine"); await expect(queue.flush()).rejects.toThrow("Offline"); expect(queue.value).toBe("mine"); expect(queue.dirty).toBe(true);
    fail = false; await queue.flush(); expect(queue.state).toBe("saved");
  });
  it("never retries stale revisions or replaces unsaved work on conflict", async () => {
    const queue = new DraftSaveQueue("initial", 1, async () => ({ ok: false, conflict: true, error: "Draft changed" }), () => undefined);
    queue.edit("mine"); await expect(queue.flush()).rejects.toThrow(); queue.edit("more edits"); await expect(queue.flush()).rejects.toThrow(); expect(queue.value).toBe("more edits"); expect(queue.state).toBe("conflict");
  });
});
