// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  testEditorialNoteContentType,
  testEditorialPostContentType,
} from "@/tests/content-fixtures";

import type { ContentRevisionSnapshot } from "../revisions";

import { CONTENT_REVISION_SNAPSHOT_VERSION } from "../const";
import {
  contentRevisionSnapshot,
  projectRevisionSnapshot,
} from "./revision-snapshot";

const row = {
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  excerpt: null,
  id: 7,
  publishedAt: new Date("2024-03-01T12:00:00.000Z"),
  slug: "hello-world",
  status: "published",
  title: "Hello world",
  updatedAt: new Date("2024-02-01T00:00:00.000Z"),
  version: 4,
  views: 12,
};

describe("contentRevisionSnapshot", () => {
  const snapshot = contentRevisionSnapshot(testEditorialPostContentType, row);

  it("stamps the schema version so a future shape change is visible", () => {
    expect(snapshot.schemaVersion).toBe(CONTENT_REVISION_SNAPSHOT_VERSION);
  });

  it("records every declared field", () => {
    expect(Object.keys(snapshot.fields).sort()).toEqual([
      "excerpt",
      "slug",
      "title",
      "views",
    ]);
  });

  it("serialises dates as ISO strings", () => {
    expect(snapshot.createdAt).toBe("2024-01-01T00:00:00.000Z");
    expect(snapshot.updatedAt).toBe("2024-02-01T00:00:00.000Z");
    expect(snapshot.publication?.publishedAt).toBe("2024-03-01T12:00:00.000Z");
  });

  it("keeps nulls explicit rather than dropping the key", () => {
    expect("excerpt" in snapshot.fields).toBe(true);
    expect(snapshot.fields.excerpt).toBeNull();
  });

  it("records the lifecycle without making it restorable", () => {
    expect(snapshot.publication).toEqual({
      publishedAt: "2024-03-01T12:00:00.000Z",
      status: "published",
    });
  });

  it("omits the lifecycle for a content type without publication", () => {
    expect(
      contentRevisionSnapshot(testEditorialNoteContentType, {
        body: null,
        createdAt: new Date(),
        id: 1,
        title: "Note",
        updatedAt: new Date(),
        version: 1,
      }).publication,
    ).toBeUndefined();
  });

  it("survives a JSON round trip unchanged", () => {
    // The whole point of flattening: a snapshot read back years later needs
    // nothing but `JSON.parse`.
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it("is deterministic for equal states", () => {
    expect(JSON.stringify(snapshot)).toBe(
      JSON.stringify(
        contentRevisionSnapshot(testEditorialPostContentType, row),
      ),
    );
  });

  it("stores no relation label, only the identifier", () => {
    const withLabels = contentRevisionSnapshot(testEditorialPostContentType, {
      ...row,
      labels: { category: "News" },
    });

    expect(withLabels.fields).not.toHaveProperty("labels");
    expect(withLabels.fields).not.toHaveProperty("category");
  });

  it("refuses to stringify an unrecognised value", () => {
    // A future column type must not smuggle "[object Object]" into a snapshot
    // and have a restore write it back as a real value.
    const odd = contentRevisionSnapshot(testEditorialPostContentType, {
      ...row,
      title: { nested: true },
    });

    expect(odd.fields.title).toBeNull();
  });
});

describe("projectRevisionSnapshot", () => {
  const base: ContentRevisionSnapshot = {
    contentTypeId: "test.editorial",
    createdAt: "2024-01-01T00:00:00.000Z",
    fields: { excerpt: null, slug: "hello", title: "Hello", views: 1 },
    id: 7,
    schemaVersion: 1,
    updatedAt: "2024-01-01T00:00:00.000Z",
    version: 1,
  };

  it("projects only currently declared fields", () => {
    const projected = projectRevisionSnapshot(testEditorialPostContentType, {
      ...base,
      fields: { ...base.fields, sinceRemoved: "gone" },
    });

    expect(projected).not.toHaveProperty("sinceRemoved");
    expect(Object.keys(projected).sort()).toEqual([
      "excerpt",
      "slug",
      "title",
      "views",
    ]);
  });

  it("omits a field the snapshot never carried", () => {
    const projected = projectRevisionSnapshot(testEditorialPostContentType, {
      ...base,
      fields: { title: "Hello" },
    });

    // Absent, not null: the record keeps whatever it holds today.
    expect(projected).toEqual({ title: "Hello" });
  });

  it("never projects a generated column", () => {
    const projected = projectRevisionSnapshot(testEditorialPostContentType, {
      ...base,
      publication: { publishedAt: null, status: "published" },
    });

    for (const name of [
      "id",
      "version",
      "status",
      "publishedAt",
      "createdAt",
    ]) {
      expect(projected).not.toHaveProperty(name);
    }
  });
});
