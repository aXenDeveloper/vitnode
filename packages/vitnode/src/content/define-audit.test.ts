import { describe, expect, it } from "vitest";

import type { ContentAuditInput } from "./types";

import { defineContentType } from "./define";
import { ContentEngineError } from "./errors";
import { field } from "./fields";

const fields = {
  title: field.text({ required: true }),
  views: field.number({ integer: true, defaultValue: 0 }),
};

const define = (audit?: ContentAuditInput<keyof typeof fields> | false) =>
  defineContentType({
    id: "test.audited",
    tableName: "test_audited",
    fields,
    ...(audit === undefined ? {} : { audit }),
  });

describe("audit", () => {
  it.each([
    [
      "is on and tracks changes by default",
      undefined,
      { enabled: true, excludeFields: [], trackChanges: true },
    ],
    [
      "is off with false",
      false,
      { enabled: false, excludeFields: [], trackChanges: false },
    ],
    [
      "keeps the excluded fields and the trackChanges choice",
      { excludeFields: ["views"], trackChanges: false },
      { enabled: true, excludeFields: ["views"], trackChanges: false },
    ],
  ] as const)("%s", (_label, audit, resolved) => {
    expect(define(audit).audit).toEqual(resolved);
  });

  it("rejects an excluded field the content type does not have", () => {
    expect(() =>
      define({
        excludeFields: ["missing" as keyof typeof fields],
      }),
    ).toThrow(ContentEngineError);
  });
});
