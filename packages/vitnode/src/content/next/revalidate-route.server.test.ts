// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CONTENT_REVALIDATE_TIMESTAMP_HEADER } from "../server/revalidate-bridge";

interface CacheCall {
  profile?: unknown;
  tag: string;
}

const calls = vi.hoisted(() => [] as CacheCall[]);

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({
  revalidateTag: (tag: string, profile: unknown) => {
    calls.push({ profile, tag });
  },
  updateTag: () => {
    throw new Error("updateTag is Server-Action-only");
  },
}));

const { POST } = await import("./revalidate-route.server");

const SECRET = "shared-secret";

const body = {
  contentTypeId: "example.article",
  id: 7,
  isPublic: true,
  mode: "immediate" as const,
  slugs: ["hello-world"],
  wasPublic: false,
};

const request = (overrides?: {
  body?: string;
  secret?: string;
  timestamp?: number | string;
}) =>
  new Request("https://web.example.com/api/vitnode/content/revalidate", {
    body: overrides?.body ?? JSON.stringify(body),
    headers: {
      authorization: `Bearer ${overrides?.secret ?? SECRET}`,
      "content-type": "application/json",
      [CONTENT_REVALIDATE_TIMESTAMP_HEADER]: String(
        overrides?.timestamp ?? Date.now(),
      ),
    },
    method: "POST",
  });

beforeEach(() => {
  calls.length = 0;
  vi.stubEnv("CRON_SECRET", SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the revalidation Route Handler", () => {
  it("expires the tags a valid request names", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(calls.length).toBeGreaterThan(0);
    // `updateTag` throws in this mock, so reaching here at all proves the
    // handler picked the Route-Handler path.
    expect(calls.every(call => call.profile !== undefined)).toBe(true);
  });

  it("expires the list, the item and the slug", async () => {
    await POST(request());

    expect(calls.map(call => call.tag).sort()).toEqual([
      "content:example.article:item:7",
      "content:example.article:list",
      "content:example.article:slug:hello-world",
    ]);
  });

  it("honours stale-while-revalidate", async () => {
    await POST(
      request({
        body: JSON.stringify({ ...body, mode: "stale-while-revalidate" }),
      }),
    );

    expect(calls[0].profile).toBe("max");
  });

  it.each([
    ["the wrong secret", { secret: "not-the-secret" }],
    ["a secret of a different length", { secret: "short" }],
  ])("refuses %s", async (_name, overrides) => {
    const response = await POST(request(overrides));

    expect(response.status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it("refuses a missing bearer token", async () => {
    const response = await POST(
      new Request("https://web.example.com/x", {
        body: JSON.stringify(body),
        method: "POST",
      }),
    );

    expect(response.status).toBe(403);
  });

  it.each([
    ["stale", Date.now() - 10 * 60 * 1000],
    ["from the future", Date.now() + 10 * 60 * 1000],
    ["not a number", "yesterday"],
  ])("refuses a timestamp that is %s", async (_name, timestamp) => {
    const response = await POST(request({ timestamp }));

    expect(response.status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it.each([
    ["not JSON", "not json at all"],
    ["the wrong shape", JSON.stringify({ nope: true })],
    ["a bad mode", JSON.stringify({ ...body, mode: "eventually" })],
  ])("answers 400 for a body that is %s", async (_name, payload) => {
    const response = await POST(request({ body: payload }));

    expect(response.status).toBe(400);
    expect(calls).toHaveLength(0);
  });
});
