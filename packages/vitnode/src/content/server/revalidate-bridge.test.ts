// @vitest-environment node
import type { Context } from "hono";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CONTENT_REVALIDATE_PATH,
  CONTENT_REVALIDATE_TIMESTAMP_HEADER,
  dispatchContentRevalidation,
} from "./revalidate-bridge";

const input = {
  contentTypeId: "example.article",
  id: 7,
  isPublic: true,
  mode: "immediate" as const,
  slugs: ["hello-world"],
  wasPublic: false,
};

const context = (overrides?: {
  cronSecret?: string;
  origins?: string[];
}): { c: Context; logged: string[] } => {
  const logged: string[] = [];
  const core = {
    contentRevalidateOrigins: overrides?.origins ?? ["https://web.example.com"],
    cronSecret: overrides?.cronSecret ?? "shared-secret",
  };

  return {
    c: {
      get: (key: string) =>
        key === "core"
          ? core
          : key === "log"
            ? {
                error: async (message: string) => {
                  logged.push(message);

                  return Promise.resolve();
                },
              }
            : undefined,
    } as unknown as Context,
    logged,
  };
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("NEXT_PUBLIC_WEB_URL", "https://web.example.com");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("dispatchContentRevalidation", () => {
  it("posts to the configured web origin with the shared secret", async () => {
    const { c } = context();

    const result = await dispatchContentRevalidation(c, input);

    expect(result).toEqual({ attempted: 1, delivered: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://web.example.com${CONTENT_REVALIDATE_PATH}`);
    expect((init.headers as Record<string, string>).authorization).toBe(
      "Bearer shared-secret",
    );
    expect(JSON.parse(init.body as string)).toEqual(input);
  });

  it("stamps a timestamp so the receiver can refuse a replay", async () => {
    const { c } = context();

    await dispatchContentRevalidation(c, input);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const stamp = Number(
      (init.headers as Record<string, string>)[
        CONTENT_REVALIDATE_TIMESTAMP_HEADER
      ],
    );

    expect(Math.abs(Date.now() - stamp)).toBeLessThan(5000);
  });

  it("posts to every configured origin independently", async () => {
    const { c } = context({
      origins: ["https://a.example.com", "https://b.example.com"],
    });

    const result = await dispatchContentRevalidation(c, input);

    expect(result).toEqual({ attempted: 2, delivered: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps going when one origin fails", async () => {
    // Separate deployments with separate caches: a stale page on one is not a
    // reason for a stale page on all of them.
    fetchMock
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockResolvedValue(new Response(null, { status: 200 }));

    const { c } = context({
      origins: ["https://down.example.com", "https://up.example.com"],
    });

    const result = await dispatchContentRevalidation(c, input);

    expect(result).toEqual({ attempted: 2, delivered: 1 });
  });

  it("retries once before giving up", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));

    const { c } = context();
    const result = await dispatchContentRevalidation(c, input);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ attempted: 1, delivered: 0 });
  });

  it("does not retry a rejected secret", async () => {
    // A 403 is a misconfiguration, and hammering it will not fix it.
    fetchMock.mockResolvedValue(new Response(null, { status: 403 }));

    const { c, logged } = context();
    await dispatchContentRevalidation(c, input);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(logged.join(" ")).toContain("CRON_SECRET");
  });

  it("never throws, whatever happens", async () => {
    // Failing the queue task would retry the *publish*, which is idempotent -
    // so the second run would skip the invalidation entirely. Strictly worse.
    fetchMock.mockRejectedValue(new Error("network is down"));

    const { c } = context();

    await expect(dispatchContentRevalidation(c, input)).resolves.toEqual({
      attempted: 1,
      delivered: 0,
    });
  });

  it("does nothing when the mutation affects no tag", async () => {
    // A draft edited into another draft touches no public response.
    const result = await dispatchContentRevalidation(context().c, {
      ...input,
      isPublic: false,
      wasPublic: false,
    });

    expect(result).toEqual({ attempted: 0, delivered: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts nowhere, and says nothing, when no origin is configured", async () => {
    // The default, not a misconfiguration. Only a front end that caches its own
    // renders has anything to expire, and it opts in by naming its origin.
    const { c, logged } = context({ origins: [] });
    const result = await dispatchContentRevalidation(c, input);

    expect(result).toEqual({ attempted: 0, delivered: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(logged).toEqual([]);
  });

  it("does not fall back to the session-cookie origin", async () => {
    // The regression this guards: a fallback to NEXT_PUBLIC_WEB_URL posts at an
    // application whose `/api/*` is a Hono mount with no such route. The 404
    // reads as a failed delivery, and `content-schedule-effects` fails the queue
    // task on a partial one - so every scheduled publish would retry its effects
    // forever over a cache that was never there.
    vi.stubEnv("NEXT_PUBLIC_WEB_URL", "https://web.example.com");

    const { c } = context({ origins: undefined });
    // `contentRevalidateOrigins` is absent from the config, not empty.
    (
      c.get("core") as { contentRevalidateOrigins?: string[] }
    ).contentRevalidateOrigins = undefined;

    const result = await dispatchContentRevalidation(c, input);

    expect(result).toEqual({ attempted: 0, delivered: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
