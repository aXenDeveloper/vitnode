// @vitest-environment node
import type { Context } from "hono";

import { describe, expect, it, vi } from "vitest";

import { testFileGalleryContentType } from "@/tests/content-fixtures";

import type { ContentFileDescriptor } from "../files";
import type { ContentFileReferenceError } from "./files";

import { ContentInputError } from "../errors";
import {
  assertContentFileReferences,
  contentFileCollectionFields,
  contentFileFields,
  contentSnapshotFileIds,
  resolveContentPublicRowFiles,
  withContentRowFiles,
} from "./files";

/** One `core_files` row as the batched read selects it. */
const fileRow = (
  id: number,
  overrides: Partial<{
    mimeType: null | string;
    name: string;
    size: number;
  }> = {},
) => ({
  id,
  key: `month_8_2026/content/${id}.webp`,
  metadata: {},
  mimeType: "image/webp",
  name: `photo-${id}.webp`,
  size: 1024,
  ...overrides,
});

/**
 * A context whose `SELECT ... FROM core_files WHERE id IN (...)` returns `rows`.
 *
 * `select` is a spy so the tests can assert the *number of statements*: a gallery
 * of four images on a page of three records still has to be one read, and a
 * regression to one per entry would pass every value assertion.
 */
const makeCtx = (rows: ReturnType<typeof fileRow>[]) => {
  const where = vi.fn().mockResolvedValue(rows);
  const select = vi.fn(() => ({ from: vi.fn(() => ({ where })) }));
  const store: Record<string, unknown> = {
    core: {
      storage: {
        adapter: { delete: vi.fn(), getUrl: vi.fn(), upload: vi.fn() },
      },
    },
    db: { select },
    storage: { getUrl: (key: string) => `https://cdn.test/${key}` },
  };

  return {
    ctx: { get: (k: string) => store[k] } as unknown as Context,
    select,
  };
};

const rejectionOf = async (
  values: Record<string, unknown>,
  rows: ReturnType<typeof fileRow>[],
): Promise<ContentFileReferenceError> => {
  const { ctx } = makeCtx(rows);

  try {
    await assertContentFileReferences(ctx, testFileGalleryContentType, values);
  } catch (error) {
    expect(error).toBeInstanceOf(ContentInputError);

    return error as ContentFileReferenceError;
  }

  throw new Error("Expected the reference check to refuse this payload.");
};

/**
 * The runtime half of `field.file({ multiple: true })`.
 *
 * Every case here is about **arity**: the same four rules the single-file suite
 * covers, applied once per entry, plus the two places where "not loaded" and
 * "empty" have to stay different answers.
 */
describe("contentFileFields", () => {
  it("finds both arities, because both hold files", () => {
    // A single file is a column and a gallery is a junction table, so the two sit
    // in different halves of the field partition - and every caller here is
    // asking about the *field*, not about where its rows live.
    expect(Object.keys(contentFileFields(testFileGalleryContentType))).toEqual([
      "cover",
      "gallery",
      "attachments",
    ]);
  });

  it("names the collections separately", () => {
    expect(
      Object.keys(contentFileCollectionFields(testFileGalleryContentType)),
    ).toEqual(["gallery", "attachments"]);
  });
});

describe("withContentRowFiles", () => {
  it("attaches a list in stored order, keeping the identifiers", async () => {
    const { ctx, select } = makeCtx([fileRow(7), fileRow(3), fileRow(9)]);

    const [row] = await withContentRowFiles(ctx, testFileGalleryContentType, [
      { attachments: [], cover: null, gallery: [7, 3, 9], id: 1 },
    ]);

    // The form's value stays the identifiers it will submit back.
    expect(row.gallery).toEqual([7, 3, 9]);
    expect(row.files.gallery).toEqual([
      expect.objectContaining({ id: 7 }),
      expect.objectContaining({ id: 3 }),
      expect.objectContaining({ id: 9 }),
    ]);
    expect(select).toHaveBeenCalledTimes(1);
  });

  it("is one statement for a whole page, however many entries", async () => {
    const { ctx, select } = makeCtx([fileRow(1), fileRow(2), fileRow(3)]);

    const rows = await withContentRowFiles(ctx, testFileGalleryContentType, [
      { attachments: [], cover: 1, gallery: [1, 2], id: 1 },
      { attachments: [3], cover: null, gallery: [2, 3], id: 2 },
    ]);

    expect(rows).toHaveLength(2);
    expect(select).toHaveBeenCalledTimes(1);
  });

  it("says nothing about a collection the response did not load", async () => {
    const { ctx } = makeCtx([fileRow(1)]);

    // What an admin *list* row looks like: the columns are there and no junction
    // table was touched. An empty array would claim the gallery is empty.
    const [row] = await withContentRowFiles(ctx, testFileGalleryContentType, [
      { cover: 1, id: 1 },
    ]);

    expect("gallery" in row.files).toBe(false);
    expect(row.files.cover).toEqual(expect.objectContaining({ id: 1 }));
  });

  it("distinguishes an empty gallery from an absent one", async () => {
    const { ctx } = makeCtx([]);

    const [row] = await withContentRowFiles(ctx, testFileGalleryContentType, [
      { attachments: [], cover: null, gallery: [], id: 1 },
    ]);

    expect(row.files.gallery).toEqual([]);
  });

  it("drops an entry whose row is gone rather than leaving a hole", async () => {
    const { ctx } = makeCtx([fileRow(7)]);

    const [row] = await withContentRowFiles(ctx, testFileGalleryContentType, [
      { attachments: [], cover: null, gallery: [7, 404], id: 1 },
    ]);

    expect(row.files.gallery).toEqual([expect.objectContaining({ id: 7 })]);
  });
});

describe("resolveContentPublicRowFiles", () => {
  it("replaces the identifiers with descriptors, once per entry", async () => {
    const { ctx } = makeCtx([fileRow(7), fileRow(3)]);

    const [row] = await resolveContentPublicRowFiles(
      ctx,
      testFileGalleryContentType,
      [{ cover: null, gallery: [7, 3], id: 1, title: "Trip" }],
    );

    const gallery = row.gallery as ContentFileDescriptor[];
    expect(gallery.map(file => file.id)).toEqual([7, 3]);
    // The allowlisted shape, and nothing else: no key, no uploader, no metadata.
    expect(Object.keys(gallery[0]).sort()).toEqual([
      "id",
      "mimeType",
      "name",
      "size",
      "url",
    ]);
  });

  it("leaves a collection the allowlist withholds alone", async () => {
    const { ctx } = makeCtx([fileRow(7)]);

    // `attachments` is not in `publicApi.fields`, so a public read never selects
    // it - and nothing here invents a descriptor for one that leaked in.
    const [row] = await resolveContentPublicRowFiles(
      ctx,
      testFileGalleryContentType,
      [{ attachments: [7], gallery: [], id: 1 }],
    );

    expect(row.attachments).toEqual([7]);
  });
});

describe("assertContentFileReferences", () => {
  it("accepts a gallery whose every entry fits the field", async () => {
    const { ctx } = makeCtx([fileRow(7), fileRow(3)]);

    await expect(
      assertContentFileReferences(ctx, testFileGalleryContentType, {
        gallery: [7, 3],
      }),
    ).resolves.toBeUndefined();
  });

  it("names the field and the offending file when one entry is too large", async () => {
    // Six megabytes into a five-megabyte field. `maxBytes` is a per-file ceiling,
    // so the other entry passing says nothing about this one.
    const error = await rejectionOf({ gallery: [7, 3] }, [
      fileRow(7),
      fileRow(3, { size: 6 * 1024 * 1024 }),
    ]);

    expect(error.field).toBe("gallery");
    expect(error.code).toBe("CONTENT_FILE_TOO_LARGE");
    expect(error.detail).toContain("File 3");
  });

  it("refuses an entry whose media type the field does not allow", async () => {
    const error = await rejectionOf({ gallery: [7] }, [
      fileRow(7, { mimeType: "application/pdf", name: "brief.pdf" }),
    ]);

    expect(error.code).toBe("CONTENT_FILE_MIME_TYPE_NOT_ALLOWED");
  });

  it("refuses an entry that does not exist", async () => {
    const error = await rejectionOf({ gallery: [7, 404] }, [fileRow(7)]);

    expect(error.code).toBe("CONTENT_FILE_NOT_FOUND");
    expect(error.field).toBe("gallery");
  });

  it("checks a file against the field it is being written to", async () => {
    // The PDF is a perfectly good upload - for `attachments`. Assigning it to the
    // gallery is a different question, and this is the one that answers it.
    const { ctx } = makeCtx([
      fileRow(7, { mimeType: "application/pdf", name: "brief.pdf" }),
    ]);

    await expect(
      assertContentFileReferences(ctx, testFileGalleryContentType, {
        attachments: [7],
      }),
    ).resolves.toBeUndefined();

    const error = await rejectionOf({ gallery: [7] }, [
      fileRow(7, { mimeType: "application/pdf", name: "brief.pdf" }),
    ]);
    expect(error.field).toBe("gallery");
  });

  it("issues no statement for a payload that names no file", async () => {
    const { ctx, select } = makeCtx([]);

    await assertContentFileReferences(ctx, testFileGalleryContentType, {
      title: "Trip",
    });

    expect(select).not.toHaveBeenCalled();
  });
});

describe("contentSnapshotFileIds", () => {
  it("pins every entry of a gallery, not just the field", () => {
    // The reason it matters: removing one image drops exactly one junction row,
    // and without a pin that file becomes deletable while every retained revision
    // still shows it.
    expect(
      contentSnapshotFileIds(testFileGalleryContentType, {
        fields: { attachments: [11], cover: 1, gallery: [7, 3, 9] },
      }),
    ).toEqual([1, 7, 3, 9, 11]);
  });

  it("deduplicates a file two fields share", () => {
    expect(
      contentSnapshotFileIds(testFileGalleryContentType, {
        fields: { cover: 7, gallery: [7, 3] },
      }),
    ).toEqual([7, 3]);
  });

  it("is empty for a snapshot that names none", () => {
    expect(
      contentSnapshotFileIds(testFileGalleryContentType, {
        fields: { attachments: [], cover: null, gallery: [] },
      }),
    ).toEqual([]);
  });
});
