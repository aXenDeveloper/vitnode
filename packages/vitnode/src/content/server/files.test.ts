// @vitest-environment node
import type { Context } from "hono";

import { describe, expect, it, vi } from "vitest";

import {
  testFilePostContentType,
  testPostContentType,
} from "@/tests/content-fixtures";

import type { ContentFileDescriptor, ContentFileFieldValue } from "../files";
import type { ContentFileReferenceError } from "./files";

import { ContentInputError } from "../errors";
import {
  assertContentFileReferences,
  contentFileFields,
  contentSnapshotFileIds,
  resolveContentFileDescriptors,
  resolveContentPublicRowFiles,
  withContentRowFiles,
} from "./files";

/** One `core_files` row as the batched read selects it. */
const fileRow = (
  id: number,
  overrides: Partial<{
    key: string;
    metadata: Record<string, unknown>;
    mimeType: null | string;
    name: string;
    size: number;
  }> = {},
) => ({
  id,
  key: `month_8_2026/content/${id}.webp`,
  metadata: {},
  mimeType: "image/webp",
  name: `cover-${id}.webp`,
  size: 1024,
  ...overrides,
});

/**
 * A context whose `SELECT ... FROM core_files WHERE id IN (...)` returns `rows`.
 *
 * `select` is a spy so the tests can assert the *number of statements*: one per
 * page is the whole point of the batched read, and a regression to one per row
 * would still pass every value assertion.
 */
const makeCtx = (
  rows: ReturnType<typeof fileRow>[],
  { hasAdapter = true }: { hasAdapter?: boolean } = {},
) => {
  const where = vi.fn().mockResolvedValue(rows);
  const select = vi.fn(() => ({ from: vi.fn(() => ({ where })) }));
  const store: Record<string, unknown> = {
    core: {
      storage: hasAdapter
        ? { adapter: { delete: vi.fn(), getUrl: vi.fn(), upload: vi.fn() } }
        : undefined,
    },
    db: { select },
    storage: { getUrl: (key: string) => `https://cdn.test/${key}` },
  };

  return {
    ctx: { get: (k: string) => store[k] } as unknown as Context,
    select,
  };
};

describe("contentFileFields", () => {
  it("finds every file field, and nothing else", () => {
    expect(Object.keys(contentFileFields(testFilePostContentType))).toEqual([
      "cover",
      "animation",
      "document",
    ]);
  });

  it("is empty for a content type that declares none", () => {
    expect(contentFileFields(testPostContentType)).toEqual({});
  });
});

describe("resolveContentFileDescriptors", () => {
  it("reads a whole page in one statement", async () => {
    const { ctx, select } = makeCtx([fileRow(1), fileRow(2)]);

    const byId = await resolveContentFileDescriptors(ctx, [1, 2, 1, 2]);

    expect(select).toHaveBeenCalledTimes(1);
    expect([...byId.keys()]).toEqual([1, 2]);
  });

  it("issues no statement for an empty or invalid id list", async () => {
    const { ctx, select } = makeCtx([]);

    expect((await resolveContentFileDescriptors(ctx, [])).size).toBe(0);
    expect((await resolveContentFileDescriptors(ctx, [0, -1, 1.5])).size).toBe(
      0,
    );
    expect(select).not.toHaveBeenCalled();
  });

  it("projects the allowlisted shape and nothing else", async () => {
    const { ctx } = makeCtx([
      fileRow(1, {
        metadata: { dimensions: { height: 900, width: 1600 }, secret: "x" },
      }),
    ]);

    const descriptor = (await resolveContentFileDescriptors(ctx, [1])).get(1);

    expect(descriptor).toEqual({
      height: 900,
      id: 1,
      mimeType: "image/webp",
      name: "cover-1.webp",
      size: 1024,
      url: "https://cdn.test/month_8_2026/content/1.webp",
      width: 1600,
    });
    // The key was read to build the URL and then dropped; the metadata bag never
    // travels.
    expect(Object.keys(descriptor ?? {})).not.toContain("key");
    expect(Object.keys(descriptor ?? {})).not.toContain("metadata");
  });

  it("omits the dimensions for a file nothing measured", async () => {
    const { ctx } = makeCtx([
      fileRow(1, { mimeType: "application/pdf", name: "spec.pdf" }),
    ]);

    const descriptor = (await resolveContentFileDescriptors(ctx, [1])).get(1);

    expect(descriptor).not.toHaveProperty("width");
    expect(descriptor).not.toHaveProperty("height");
  });

  it("answers an empty URL rather than throwing with no adapter", async () => {
    const { ctx } = makeCtx([fileRow(1)], { hasAdapter: false });

    expect((await resolveContentFileDescriptors(ctx, [1])).get(1)?.url).toBe(
      "",
    );
  });
});

const one = (
  value: ContentFileFieldValue | undefined,
): ContentFileDescriptor | null =>
  value === undefined || Array.isArray(value) ? null : value;

describe("withContentRowFiles", () => {
  it("attaches the descriptors beside the row, keeping the identifier", async () => {
    const { ctx, select } = makeCtx([fileRow(1), fileRow(2)]);

    const [row] = await withContentRowFiles(ctx, testFilePostContentType, [
      { animation: 2, cover: 1, document: null, id: 7 },
    ]);

    // The form's value stays the identifier it will submit back.
    expect(row.cover).toBe(1);
    expect(one(row.files.cover)?.name).toBe("cover-1.webp");
    expect(one(row.files.animation)?.id).toBe(2);
    expect(row.files.document).toBeNull();
    expect(select).toHaveBeenCalledTimes(1);
  });

  it("reads one statement for a whole page of rows", async () => {
    const { ctx, select } = makeCtx([fileRow(1), fileRow(2), fileRow(3)]);

    const rows = await withContentRowFiles(
      ctx,
      testFilePostContentType,
      [1, 2, 3].map(id => ({ animation: null, cover: id, document: null, id })),
    );

    expect(rows).toHaveLength(3);
    expect(select).toHaveBeenCalledTimes(1);
  });

  it("issues no statement for a content type with no file fields", async () => {
    const { ctx, select } = makeCtx([]);

    const [row] = await withContentRowFiles(ctx, testPostContentType, [
      { id: 7, title: "Hi" },
    ]);

    expect(row.files).toEqual({});
    expect(select).not.toHaveBeenCalled();
  });
});

describe("resolveContentPublicRowFiles", () => {
  it("replaces the exposed identifier with its descriptor", async () => {
    const { ctx } = makeCtx([fileRow(1)]);

    const [row] = await resolveContentPublicRowFiles(
      ctx,
      testFilePostContentType,
      [{ cover: 1, id: 7, slug: "hello" }],
    );

    expect(row.cover).toMatchObject({ id: 1, name: "cover-1.webp" });
  });

  it("resolves only the fields the allowlist exposes", async () => {
    const { ctx, select } = makeCtx([fileRow(1)]);

    const [row] = await resolveContentPublicRowFiles(
      ctx,
      testFilePostContentType,
      [{ animation: 2, cover: 1, id: 7 }],
    );

    expect(row.animation).toBe(2);
    expect(select).toHaveBeenCalledTimes(1);
  });

  it("leaves a row alone when the content type exposes no file", async () => {
    const { ctx, select } = makeCtx([]);
    const rows = [{ id: 7, title: "Hi" }];

    expect(
      await resolveContentPublicRowFiles(ctx, testPostContentType, rows),
    ).toBe(rows);
    expect(select).not.toHaveBeenCalled();
  });

  it("answers null for a file that no longer exists", async () => {
    const { ctx } = makeCtx([]);

    const [row] = await resolveContentPublicRowFiles(
      ctx,
      testFilePostContentType,
      [{ cover: 99, id: 7 }],
    );

    expect(row.cover).toBeNull();
  });
});

describe("assertContentFileReferences", () => {
  const ok = async (
    values: Record<string, unknown>,
    rows: ReturnType<typeof fileRow>[],
  ) => {
    const { ctx } = makeCtx(rows);

    return await assertContentFileReferences(
      ctx,
      testFilePostContentType,
      values,
    );
  };

  const rejection = async (
    values: Record<string, unknown>,
    rows: ReturnType<typeof fileRow>[],
  ) => {
    const { ctx } = makeCtx(rows);

    return await assertContentFileReferences(
      ctx,
      testFilePostContentType,
      values,
    )
      .then(() => null)
      .catch((error: unknown) => error as ContentFileReferenceError);
  };

  it("accepts a file that fits the field it is assigned to", async () => {
    await expect(
      ok({ cover: 1 }, [fileRow(1, { name: "hero.webp" })]),
    ).resolves.toBeUndefined();
  });

  it("issues no statement when the payload names no file", async () => {
    const { ctx, select } = makeCtx([]);

    await assertContentFileReferences(ctx, testFilePostContentType, {
      title: "Hi",
    });

    expect(select).not.toHaveBeenCalled();
  });

  it("issues no statement for a content type with no file fields", async () => {
    const { ctx, select } = makeCtx([]);

    await assertContentFileReferences(ctx, testPostContentType, { cover: 1 });

    expect(select).not.toHaveBeenCalled();
  });

  it("refuses an identifier with no row behind it", async () => {
    const error = await rejection({ cover: 99 }, []);

    expect(error?.code).toBe("CONTENT_FILE_NOT_FOUND");
    expect(error?.field).toBe("cover");
  });

  it("refuses an existing PDF assigned to a GIF-only field", async () => {
    const error = await rejection({ animation: 5 }, [
      fileRow(5, { mimeType: "application/pdf", name: "spec.pdf" }),
    ]);

    expect(error?.code).toBe("CONTENT_FILE_MIME_TYPE_NOT_ALLOWED");
    expect(error?.field).toBe("animation");
  });

  it("refuses an existing PNG assigned to a GIF-only field", async () => {
    const error = await rejection({ animation: 6 }, [
      fileRow(6, { mimeType: "image/png", name: "shot.png" }),
    ]);

    expect(error?.code).toBe("CONTENT_FILE_MIME_TYPE_NOT_ALLOWED");
  });

  it("refuses a file whose extension matches but whose type does not", async () => {
    const error = await rejection({ animation: 7 }, [
      fileRow(7, { mimeType: "image/png", name: "renamed.gif" }),
    ]);

    expect(error?.code).toBe("CONTENT_FILE_MIME_TYPE_NOT_ALLOWED");
  });

  it("refuses a file whose type matches but whose extension does not", async () => {
    const error = await rejection({ animation: 8 }, [
      fileRow(8, { mimeType: "image/gif", name: "renamed.png" }),
    ]);

    expect(error?.code).toBe("CONTENT_FILE_EXTENSION_NOT_ALLOWED");
  });

  it("refuses a file that outgrew the field's ceiling", async () => {
    const error = await rejection({ animation: 9 }, [
      fileRow(9, {
        mimeType: "image/gif",
        name: "huge.gif",
        size: 10 * 1024 * 1024 + 1,
      }),
    ]);

    expect(error?.code).toBe("CONTENT_FILE_TOO_LARGE");
  });

  it("answers with a 400-shaped error the routes already map", async () => {
    const error = await rejection({ cover: 99 }, []);

    // `ContentInputError` is what `rethrowAsHttpError` turns into a 400 with the
    // message intact, so this needs no new error channel.
    expect(error).toBeInstanceOf(ContentInputError);
    expect(error?.message).not.toContain("core_files");
  });

  it("checks every named field, not just the first", async () => {
    const error = await rejection({ animation: 6, cover: 1 }, [
      fileRow(1),
      fileRow(6, { mimeType: "image/png", name: "shot.png" }),
    ]);

    expect(error?.field).toBe("animation");
  });
});

describe("contentSnapshotFileIds", () => {
  it("finds the file ids a snapshot names", () => {
    expect(
      contentSnapshotFileIds(testFilePostContentType, {
        fields: { animation: 2, cover: 1, document: null, title: "Hi" },
      }),
    ).toEqual([1, 2]);
  });

  it("deduplicates, so one pin exists per file", () => {
    expect(
      contentSnapshotFileIds(testFilePostContentType, {
        fields: { animation: 1, cover: 1, document: 1 },
      }),
    ).toEqual([1]);
  });

  it("is empty for a content type with no file fields", () => {
    expect(
      contentSnapshotFileIds(testPostContentType, { fields: { title: "Hi" } }),
    ).toEqual([]);
  });

  it("is empty for a snapshot that names no file", () => {
    expect(
      contentSnapshotFileIds(testFilePostContentType, {
        fields: { cover: null },
      }),
    ).toEqual([]);
  });
});
