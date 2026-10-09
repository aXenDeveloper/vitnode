// @vitest-environment node
import type { Context } from "hono";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ContentRevalidationRequest } from "./revalidate-bridge";

import { INSECURE_DEFAULT_CRON_SECRET } from "../../lib/config";

const SECRET = "a-long-random-production-secret";
const INPUT: ContentRevalidationRequest = {
  contentTypeId: "blog.post",
  id: 1,
  isPublic: true,
  mode: "immediate",
  slugs: ["hello"],
  wasPublic: false,
};

const harness = ({
  cronSecret = SECRET,
  origins,
}: {
  cronSecret?: string;
  origins: string[];
}) => {
  const fetch = vi.fn(
    async (_url: string, _init: RequestInit) =>
      await Promise.resolve(new Response(null, { status: 200 })),
  );
  vi.stubGlobal("fetch", fetch);

  const log = {
    error: vi.fn().mockResolvedValue(undefined),
    warn: vi.fn().mockResolvedValue(undefined),
  };
  const store: Record<string, unknown> = {
    core: { contentRevalidateOrigins: origins, cronSecret },
    log,
  };
  const c = { get: (key: string) => store[key] } as unknown as Context;

  return { c, fetch, log };
};

const load = async () => await import("./revalidate-bridge");

describe("dispatchContentRevalidation", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("posts the bearer and a timestamp to every https origin", async () => {
    const { dispatchContentRevalidation, CONTENT_REVALIDATE_PATH } =
      await load();
    const { c, fetch } = harness({
      origins: ["https://www.example.com", "https://mirror.example.com"],
    });

    await expect(dispatchContentRevalidation(c, INPUT)).resolves.toEqual({
      attempted: 2,
      delivered: 2,
    });

    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      `https://www.example.com${CONTENT_REVALIDATE_PATH}`,
      `https://mirror.example.com${CONTENT_REVALIDATE_PATH}`,
    ]);
    const headers = fetch.mock.calls[0][1].headers as Record<string, string>;
    expect(headers.authorization).toBe(`Bearer ${SECRET}`);
    expect(Number(headers["x-vitnode-timestamp"])).toBeGreaterThan(0);
  });

  it.each([
    ["the built-in default", INSECURE_DEFAULT_CRON_SECRET],
    ["a placeholder", "changeme"],
    ["an empty value", ""],
  ])(
    "sends nothing in production when CRON_SECRET is %s",
    async (_, cronSecret) => {
      const { dispatchContentRevalidation } = await load();
      const { c, fetch, log } = harness({
        cronSecret,
        origins: ["https://www.example.com"],
      });

      await expect(dispatchContentRevalidation(c, INPUT)).resolves.toEqual({
        attempted: 1,
        delivered: 0,
      });
      expect(fetch).not.toHaveBeenCalled();
      expect(log.warn).toHaveBeenCalledWith(
        expect.stringContaining("CRON_SECRET"),
      );
    },
  );

  it("warns about a rejected secret only once", async () => {
    const { dispatchContentRevalidation } = await load();
    const { c, log } = harness({
      cronSecret: INSECURE_DEFAULT_CRON_SECRET,
      origins: ["https://www.example.com"],
    });

    await dispatchContentRevalidation(c, INPUT);
    await dispatchContentRevalidation(c, INPUT);

    expect(log.warn).toHaveBeenCalledTimes(1);
  });

  it("still sends the default secret in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { dispatchContentRevalidation } = await load();
    const { c, fetch } = harness({
      cronSecret: INSECURE_DEFAULT_CRON_SECRET,
      origins: ["http://web:3000"],
    });

    await expect(dispatchContentRevalidation(c, INPUT)).resolves.toEqual({
      attempted: 1,
      delivered: 1,
    });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("refuses a plain http origin and keeps notifying the others", async () => {
    const { dispatchContentRevalidation } = await load();
    const { c, fetch, log } = harness({
      origins: ["http://www.example.com", "https://mirror.example.com"],
    });

    await expect(dispatchContentRevalidation(c, INPUT)).resolves.toEqual({
      attempted: 2,
      delivered: 1,
    });
    expect(fetch.mock.calls.map(([url]) => new URL(url).origin)).toEqual([
      "https://mirror.example.com",
    ]);
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining("http://www.example.com"),
    );
  });

  it.each(["http://localhost:3000", "http://127.0.0.1:3000"])(
    "allows the loopback origin %s over http",
    async origin => {
      const { dispatchContentRevalidation } = await load();
      const { c, fetch } = harness({ origins: [origin] });

      await expect(dispatchContentRevalidation(c, INPUT)).resolves.toEqual({
        attempted: 1,
        delivered: 1,
      });
      expect(fetch).toHaveBeenCalledOnce();
    },
  );

  it("refuses an origin that is not a URL", async () => {
    const { dispatchContentRevalidation } = await load();
    const { c, fetch } = harness({ origins: ["www.example.com"] });

    await expect(dispatchContentRevalidation(c, INPUT)).resolves.toEqual({
      attempted: 1,
      delivered: 0,
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});
