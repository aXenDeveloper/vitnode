import { describe, expect, it } from "vitest";

import {
  MODERATION_LIMITS,
  MODERATION_SNAPSHOT_VERSION,
} from "@/lib/moderation/const";

import type { ModerationCaptureResult } from "./targets";

import { sealReportSnapshot } from "./snapshot";

const TARGET = { id: "7", pluginId: "@vitnode/forum", type: "forum.topic" };
const CAPTURED_AT = new Date("2026-01-02T03:04:05.000Z");

const capture = (
  overrides: Partial<ModerationCaptureResult> = {},
): ModerationCaptureResult => ({
  authors: [{ id: 1, name: "Ada" }],
  fields: [{ kind: "text", label: null, name: "body", value: "Hello" }],
  locale: { fallback: false, requested: "en", served: "en" },
  scope: null,
  source: { publishedAt: null, updatedAt: null, version: null },
  title: "A topic",
  url: "/topics/7",
  ...overrides,
});

const seal = (overrides: Partial<ModerationCaptureResult> = {}) =>
  sealReportSnapshot({
    capture: capture(overrides),
    capturedAt: CAPTURED_AT,
    target: TARGET,
  });

describe("sealReportSnapshot", () => {
  it("stamps, versions and keeps a small capture whole", () => {
    expect(seal()).toEqual({
      ...capture(),
      capturedAt: CAPTURED_AT.toISOString(),
      target: TARGET,
      truncated: false,
      version: MODERATION_SNAPSHOT_VERSION,
    });
  });

  it("cuts a long text value and the title, and says so", () => {
    const snapshot = seal({
      fields: [
        {
          kind: "text",
          label: null,
          name: "body",
          value: "x".repeat(MODERATION_LIMITS.snapshotTextMaxLength + 10),
        },
      ],
      title: "t".repeat(600),
    });

    expect(snapshot.truncated).toBe(true);
    expect(snapshot.title).toHaveLength(500);
    expect(snapshot.fields[0]?.value).toHaveLength(
      MODERATION_LIMITS.snapshotTextMaxLength,
    );
  });

  it("drops fields from the end until the document fits", () => {
    const big = (name: string) => ({
      kind: "text" as const,
      label: null,
      name,
      value: "y".repeat(MODERATION_LIMITS.snapshotTextMaxLength),
    });
    const count =
      Math.ceil(
        MODERATION_LIMITS.snapshotMaxBytes /
          MODERATION_LIMITS.snapshotTextMaxLength,
      ) + 2;

    const snapshot = seal({
      fields: Array.from({ length: count }, (_, index) => big(`f${index}`)),
    });

    expect(snapshot.truncated).toBe(true);
    expect(snapshot.fields.length).toBeLessThan(count);
    expect(snapshot.fields[0]?.name).toBe("f0");
    expect(
      Buffer.byteLength(JSON.stringify(snapshot), "utf8"),
    ).toBeLessThanOrEqual(MODERATION_LIMITS.snapshotMaxBytes);
  });
});
