import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handleCronJobs } from "./cron";

describe("handleCronJobs", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.stubEnv("VITNODE_API_URL", "http://localhost:8000");
    vi.stubEnv("CRON_SECRET", "a-real-secret");
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    consoleError.mockRestore();
  });

  it("posts the tick to the API with the cron secret", async () => {
    const fetchMock = vi.fn(async () =>
      Promise.resolve(new Response("ok", { status: 200 })),
    );
    vi.stubGlobal("fetch", fetchMock);

    await handleCronJobs();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/@vitnode/core/cron",
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer a-real-secret",
        }),
        method: "POST",
      }),
    );
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("reports a tick the API rejects instead of dropping it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Promise.resolve(
          new Response("CRON_SECRET is still the built-in default", {
            status: 403,
          }),
        ),
      ),
    );

    await handleCronJobs();

    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("403 CRON_SECRET is still the built-in default"),
    );
  });

  it("reports an unreachable API without throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Promise.reject(new Error("connect ECONNREFUSED 127.0.0.1:8000")),
      ),
    );

    await expect(handleCronJobs()).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("ECONNREFUSED"),
    );
  });
});
