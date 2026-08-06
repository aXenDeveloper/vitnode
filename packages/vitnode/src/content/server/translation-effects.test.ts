// @vitest-environment node
import type { Context } from "hono";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { testLocalizedGuideContentType } from "@/tests/content-fixtures";

import type { ContentTranslationEditorialOutcome } from "./translation-editorial-service";

import { contentTranslationEffects } from "./translation-effects";

/**
 * The event transport, recording rather than delivering.
 *
 * Typed loosely on purpose: what these tests assert is the *name* and the
 * *payload* the effects choose, and pinning the emitter's signature to the global
 * event map would make the assertions depend on whether a plugin's `declare
 * module` block happens to be in the program.
 */
const emit = vi.fn(
  (_name: string, _payload: Record<string, unknown>, _options?: unknown) => ({
    failures: [] as { error: string; listener: string }[],
    listeners: 1,
  }),
);

const context = () =>
  ({
    get: (key: string) => (key === "events" ? { emit } : undefined),
  }) as unknown as Context;

const outcome = (
  overrides: Partial<ContentTranslationEditorialOutcome<unknown>> = {},
): ContentTranslationEditorialOutcome<never> =>
  ({
    changed: true,
    changedFields: [],
    languageId: 2,
    locale: "pl",
    operation: "update",
    previousSlug: null,
    restoredFromRevisionId: null,
    revisionId: 101,
    row: {
      createdAt: new Date(),
      itemId: 7,
      languageId: 2,
      locale: "pl",
      publishedAt: null,
      status: "draft",
      updatedAt: new Date(),
      values: {},
      version: 2,
    },
    version: 2,
    ...overrides,
  }) as never;

const run = async (
  overrides: Partial<ContentTranslationEditorialOutcome<unknown>> = {},
) =>
  await contentTranslationEffects(
    context(),
    testLocalizedGuideContentType,
    outcome(overrides),
    { pluginId: "@vitnode/example" },
  );

beforeEach(() => {
  emit.mockClear();
});

describe("one event per real mutation", () => {
  it.each([
    ["create", "translation_created"],
    ["update", "translation_updated"],
    ["delete", "translation_deleted"],
    ["publish", "translation_published"],
    ["unpublish", "translation_unpublished"],
    ["restore", "translation_restored"],
  ] as const)("maps %s to %s", async (operation, action) => {
    await run({ operation });

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith(
      `content.test.localized-guide.${action}`,
      expect.anything(),
      { pluginId: "@vitnode/example" },
    );
  });

  it("never emits the plain `updated` event", async () => {
    await run({ operation: "update" });

    // A shared update and a Polish translation update are different domain facts
    // with different consequences - one invalidates every locale, the other one.
    const [name] = emit.mock.calls[0];
    expect(name).not.toBe("content.test.localized-guide.updated");
  });

  it("emits nothing for a no-op", async () => {
    const result = await run({ changed: false });

    expect(emit).not.toHaveBeenCalled();
    expect(result.event).toBeNull();
  });
});

describe("payloads", () => {
  it("always names the locale and the language", async () => {
    await run({ operation: "create" });

    expect(emit.mock.calls[0][1]).toMatchObject({
      contentId: 7,
      languageId: 2,
      locale: "pl",
      revisionId: 101,
      version: 2,
    });
  });

  it("carries changedFields on an update", async () => {
    await run({ changedFields: ["title"] as never, operation: "update" });

    expect(emit.mock.calls[0][1]).toMatchObject({ changedFields: ["title"] });
  });

  it("carries the source revision on a restore", async () => {
    await run({ operation: "restore", restoredFromRevisionId: 42 });

    expect(emit.mock.calls[0][1]).toMatchObject({
      restoredFromRevisionId: 42,
      revisionId: 101,
    });
  });

  it("carries publishedAt on a publish", async () => {
    const publishedAt = new Date("2026-02-01T00:00:00Z");
    await run({
      operation: "publish",
      row: {
        createdAt: new Date(),
        itemId: 7,
        languageId: 2,
        locale: "pl",
        publishedAt,
        status: "published",
        updatedAt: new Date(),
        values: {},
        version: 2,
      } as never,
    });

    expect(emit.mock.calls[0][1]).toMatchObject({ publishedAt });
  });

  it("omits revisionId when there is no history", async () => {
    // The path a localized content type without `editorial` takes: the event still
    // fires, but there is no revision to point at, so the key is absent rather
    // than zero.
    await run({ operation: "create", revisionId: null });

    expect(emit.mock.calls[0][1]).not.toHaveProperty("revisionId");
  });
});

describe("failure reporting", () => {
  it("returns what the transport said rather than swallowing it", async () => {
    emit.mockReturnValueOnce({
      failures: [{ error: "boom", listener: "x" }],
      listeners: 1,
    });

    const result = await run();

    // `emit` never throws, so `failures` is the only place a dead listener is
    // visible - and the mutation has already committed either way.
    expect(result.event?.failures).toHaveLength(1);
  });
});
