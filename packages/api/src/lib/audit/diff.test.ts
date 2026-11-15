import { describe, expect, it } from "vitest";

import { AUDIT_RICH_TEXT } from "./const";
import { auditDiff } from "./diff";

const doc = (text: string) => ({
  content: [{ content: [{ text, type: "text" }], type: "paragraph" }],
  type: "doc",
});

describe("auditDiff", () => {
  it("leaves unchanged fields out and keeps transitions to and from null", () => {
    expect(
      auditDiff({
        after: { color: "#fff", name: "News", parentId: null },
        before: { color: null, name: "News", parentId: 3 },
      }),
    ).toEqual({
      color: { from: null, to: "#fff" },
      parentId: { from: 3, to: null },
    });
  });

  it("counts a field missing on one side as null", () => {
    expect(auditDiff({ after: { name: "News" }, before: null })).toEqual({
      name: { from: null, to: "News" },
    });
  });

  it("is null when nothing moved", () => {
    expect(
      auditDiff({
        after: { tags: [1, 2], updated: new Date("2026-01-01T00:00:00Z") },
        before: { tags: [1, 2], updated: new Date("2026-01-01T00:00:00Z") },
      }),
    ).toBeNull();
  });

  it("compares only the included fields and skips the excluded ones", () => {
    const before = { name: "A", slug: "a", updatedAt: 1 };
    const after = { name: "B", slug: "b", updatedAt: 2 };

    expect(auditDiff({ after, before, include: ["name"] })).toEqual({
      name: { from: "A", to: "B" },
    });
    expect(auditDiff({ after, before, exclude: ["updatedAt"] })).toEqual({
      name: { from: "A", to: "B" },
      slug: { from: "a", to: "b" },
    });
  });

  it("records a sensitive field without its values", () => {
    expect(
      auditDiff({
        after: { passwordHash: "new" },
        before: { passwordHash: "old" },
      }),
    ).toEqual({ passwordHash: { redacted: true } });
  });

  it("stores a changed rich-text document as a marker, and an unchanged one not at all", () => {
    expect(
      auditDiff({
        after: { body: doc("new"), intro: doc("same") },
        before: { body: doc("old"), intro: doc("same") },
      }),
    ).toEqual({ body: { from: AUDIT_RICH_TEXT, to: AUDIT_RICH_TEXT } });
  });

  it("serializes dates in a recorded change", () => {
    expect(
      auditDiff({
        after: { publishedAt: new Date("2026-02-01T00:00:00.000Z") },
        before: { publishedAt: null },
      }),
    ).toEqual({
      publishedAt: { from: null, to: "2026-02-01T00:00:00.000Z" },
    });
  });
});
