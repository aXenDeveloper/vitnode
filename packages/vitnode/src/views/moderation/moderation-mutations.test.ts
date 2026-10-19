import { afterEach, describe, expect, it, vi } from "vitest";

import { createReport } from "./moderation-mutations";

const input = {
  description: null,
  locale: null,
  pluginId: "@vitnode/forum",
  reason: "spam",
  targetId: "1",
  targetType: "forum.topic",
} as const;

const respond = (status: number, body: unknown) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        await Promise.resolve(
          new Response(JSON.stringify(body), {
            headers: { "content-type": "application/json" },
            status,
          }),
        ),
    ),
  );
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createReport", () => {
  it.each([
    [401, { message: "Sign in first." }, "unauthenticated"],
    [400, { message: "Invalid" }, "validation"],
    [404, { error: "not_found" }, "not_found"],
    [409, { error: "duplicate" }, "duplicate"],
    [429, { error: "rate_limited" }, "rate_limited"],
  ])("turns a %i (%j) into a %s failure", async (status, body, failure) => {
    respond(status, body);

    expect(await createReport(input)).toEqual({ failure, ok: false });
  });

  it("returns the new report's id", async () => {
    respond(201, { id: 7 });

    expect(await createReport(input)).toEqual({ data: { id: 7 }, ok: true });
  });
});
