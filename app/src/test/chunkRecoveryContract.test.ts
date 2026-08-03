/**
 * Stale-chunk recovery contract (lazyWithRetry / importWithReload):
 *
 * Deploys delete the previous release's hashed chunks, so a tab that stayed
 * open across a deploy 404s on its next lazy import. The contract:
 *
 *  - a failed import triggers exactly one page reload per chunk key, and the
 *    caller's promise stays pending while the reload happens;
 *  - the same chunk failing again after its reload was spent surfaces the
 *    error (bounded — never a reload loop);
 *  - a *different* chunk failing later in the same session still gets its own
 *    reload (a session that recovered at deploy N can recover at deploy N+1);
 *  - with sessionStorage unavailable (private mode) the reload is skipped
 *    entirely, because a loop there would be undetectable.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { importWithReload } from "@/lib/lazyWithRetry";

const chunkError = new TypeError(
  "Failed to fetch dynamically imported module: https://verveq.com/assets/ShellHomeScreen-2i5lTzko.js",
);

beforeEach(() => {
  sessionStorage.clear();
});

describe("stale-chunk recovery", () => {
  it("reloads once on a failed import and leaves the promise pending", async () => {
    const reload = vi.fn();
    const pending = importWithReload(() => Promise.reject(chunkError), reload);
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));

    let settled = false;
    void pending.finally(() => {
      settled = true;
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(settled).toBe(false);
  });

  it("surfaces the error instead of reloading again for the same chunk", async () => {
    const reload = vi.fn();
    const factory = () => Promise.reject(chunkError);
    void importWithReload(factory, reload);
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));

    await expect(importWithReload(factory, reload)).rejects.toThrow(
      "Failed to fetch dynamically imported module",
    );
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("still reloads for a different chunk after one reload was spent", async () => {
    const reload = vi.fn();
    void importWithReload(() => Promise.reject(chunkError), reload);
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));

    const otherFactory = () =>
      Promise.reject(new TypeError("error loading OtherScreen-abc123.js"));
    void importWithReload(otherFactory, reload);
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(2));
  });

  it("passes a successful import straight through", async () => {
    const reload = vi.fn();
    await expect(
      importWithReload(() => Promise.resolve({ default: "mod" }), reload),
    ).resolves.toEqual({ default: "mod" });
    expect(reload).not.toHaveBeenCalled();
  });

  it("never reloads when sessionStorage is unavailable (private mode)", async () => {
    const reload = vi.fn();
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new DOMException("denied", "SecurityError");
      });
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("denied", "SecurityError");
      });
    try {
      await expect(
        importWithReload(() => Promise.reject(chunkError), reload),
      ).rejects.toThrow("Failed to fetch dynamically imported module");
      expect(reload).not.toHaveBeenCalled();
    } finally {
      getItem.mockRestore();
      setItem.mockRestore();
    }
  });
});
