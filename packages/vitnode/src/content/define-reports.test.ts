import { describe, expect, it } from "vitest";

import type { ContentReportsInput } from "./types";

import { defineContentType } from "./define";
import { field } from "./fields";

const fields = {
  title: field.text({ required: true }),
  slug: field.slug({ source: "title" }),
  body: field.richText({ nullable: true }),
  summary: field.textarea({ nullable: true }),
  internalNote: field.text({ nullable: true }),
  views: field.number({ integer: true, defaultValue: 0 }),
  author: field.user({ nullable: true, onDelete: "set null" }),
};

const define = (
  reports: ContentReportsInput<keyof typeof fields> | undefined,
  publicApi = true,
) =>
  defineContentType({
    id: "test.reportable",
    tableName: "test_reportables",
    fields,
    publication: true,
    admin: { titleField: "title" },
    ...(publicApi
      ? {
          publicApi: {
            path: "reportables",
            fields: ["title", "slug", "body", "summary", "views"],
          },
        }
      : {}),
    reports,
  });

describe("reports", () => {
  it.each([undefined, false] as const)("is off when %s", reports => {
    expect(define(reports).reports).toEqual({
      enabled: false,
      selfReport: false,
      snapshotFields: [],
      titleField: null,
    });
  });

  it("snapshots the public reader-facing fields, minus the title", () => {
    expect(define(true).reports).toEqual({
      enabled: true,
      selfReport: false,
      snapshotFields: ["body", "summary"],
      titleField: "title",
    });
  });

  it("takes explicit fields, private ones included", () => {
    expect(
      define({ snapshotFields: ["internalNote", "views"], titleField: "slug" })
        .reports,
    ).toEqual({
      enabled: true,
      selfReport: false,
      snapshotFields: ["internalNote", "views"],
      titleField: "slug",
    });
  });

  it("needs a public API", () => {
    expect(() => define(true, false)).toThrow(/reports needs `publicApi`/);
  });

  it.each([
    [
      "an unknown snapshot field",
      { snapshotFields: ["missing"] },
      /unknown field "missing"/,
    ],
    [
      "a snapshot field of a kind it cannot hold",
      { snapshotFields: ["author"] },
      /names the user field "author"/,
    ],
    [
      "an unknown title field",
      { titleField: "missing" },
      /titleField "missing"/,
    ],
    [
      "a title field that is not text",
      { titleField: "views" },
      /titleField "views"/,
    ],
    [
      "the removed `enabled` key",
      { enabled: true },
      /reports.enabled is not an option/,
    ],
  ])("rejects %s", (_label, reports, message) => {
    expect(() => define(reports as never)).toThrow(message);
  });
});
