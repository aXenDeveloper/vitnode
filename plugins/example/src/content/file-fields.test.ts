// @vitest-environment node
import {
  contentFileAccept,
  contentFileConstraints,
  contentFileFormatLabels,
  validateContentFile,
} from "@vitnode/core/content";
import { describe, expect, it } from "vitest";

import { articleContentType } from "./article";

/**
 * The extension-only reference field, exercised as a matrix.
 *
 * `example.article.animation` states exactly one extension and exactly one media
 * type, which makes it the field where "both rules have to match" is visible: a
 * PNG renamed to `.gif` passes the filename check and fails the type check, and
 * that is the only reason it is refused.
 *
 * A GIF is also the format that proves the storage pipeline is not quietly
 * changing the rules - `sharp` never re-encodes GIF, so the stored file keeps
 * its extension.
 */
const animation = articleContentType.fields.animation;
const constraints = contentFileConstraints(animation);

const check = (name: string, mimeType: null | string, size = 1024) =>
  validateContentFile(constraints, { mimeType, name, size });

describe("example.article.animation - the GIF-only field", () => {
  it("is declared with one extension, one media type and a ceiling", () => {
    expect(animation).toMatchObject({
      allowedExtensions: [".gif"],
      allowedMimeTypes: ["image/gif"],
      kind: "file",
      maxBytes: 10 * 1024 * 1024,
    });
  });

  it("accepts a GIF", () => {
    expect(check("banner.gif", "image/gif")).toBeNull();
  });

  it("accepts a GIF whatever the case of its name", () => {
    expect(check("BANNER.GIF", "image/gif")).toBeNull();
  });

  it("refuses a PNG", () => {
    expect(check("shot.png", "image/png")?.code).toBe(
      "CONTENT_FILE_MIME_TYPE_NOT_ALLOWED",
    );
  });

  it("refuses a PNG renamed to .gif, because the media type is wrong", () => {
    expect(check("renamed.gif", "image/png")?.code).toBe(
      "CONTENT_FILE_MIME_TYPE_NOT_ALLOWED",
    );
  });

  it("refuses a GIF whose name says otherwise", () => {
    expect(check("renamed.png", "image/gif")?.code).toBe(
      "CONTENT_FILE_EXTENSION_NOT_ALLOWED",
    );
  });

  it("refuses a GIF over 10 MB", () => {
    expect(check("huge.gif", "image/gif", 10 * 1024 * 1024 + 1)?.code).toBe(
      "CONTENT_FILE_TOO_LARGE",
    );
  });

  it("accepts a GIF of exactly 10 MB", () => {
    expect(check("edge.gif", "image/gif", 10 * 1024 * 1024)).toBeNull();
  });

  it("refuses a file with no declared type at all", () => {
    expect(check("banner.gif", null)?.code).toBe(
      "CONTENT_FILE_MIME_TYPE_NOT_ALLOWED",
    );
  });

  it("tells the browser to offer both the extension and the type", () => {
    expect(contentFileAccept(constraints)).toBe(".gif,image/gif");
  });

  it("says GIF, not image/gif", () => {
    expect(contentFileFormatLabels(constraints)).toEqual(["GIF"]);
  });

  it("is optional, sortable by nothing and filterable by nothing", () => {
    expect(animation.nullable).toBe(true);
    expect(articleContentType.admin.list.orderableFields).not.toContain(
      "animation",
    );
    expect(articleContentType.publicApi.filterableFields).not.toContain(
      "animation",
    );
  });

  it("is exposed publicly, and shown in the list", () => {
    expect(articleContentType.publicApi.fields).toContain("animation");
    expect(articleContentType.admin.list.columns).toContain("animation");
  });
});

const gallery = articleContentType.fields.gallery;
const galleryConstraints = contentFileConstraints(gallery);

describe("example.article.gallery - the ordered many-files field", () => {
  it("is a collection with its own bounds and the editor's order", () => {
    expect(gallery).toMatchObject({
      kind: "file",
      max: 8,
      maxBytes: 5 * 1024 * 1024,
      min: 1,
      multiple: true,
      ordered: true,
    });
  });

  it("is neither required nor nullable - the empty gallery is the empty state", () => {
    expect(gallery.required).toBe(false);
    expect(gallery.nullable).toBe(false);
  });

  it("applies maxBytes per file, not as a budget for the list", () => {
    const under = validateContentFile(galleryConstraints, {
      mimeType: "image/webp",
      name: "photo.webp",
      size: 5 * 1024 * 1024,
    });
    const over = validateContentFile(galleryConstraints, {
      mimeType: "image/webp",
      name: "photo.webp",
      size: 5 * 1024 * 1024 + 1,
    });

    expect(under).toBeNull();
    expect(over?.code).toBe("CONTENT_FILE_TOO_LARGE");
  });

  it("allows the format the image pipeline actually stores", () => {
    // With `storage.image` configured a `photo.png` is re-encoded and *stored* as
    // `photo.webp`, so a field that allowed only the formats a person picks would
    // refuse the file it had just created.
    expect(gallery.allowedExtensions).toContain(".webp");
    expect(gallery.allowedMimeTypes).toContain("image/webp");
  });

  it("generates a junction table rather than a column", () => {
    expect(articleContentType.advanced.junctions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "gallery",
          tableName: "example_articles_gallery",
        }),
      ]),
    );
  });

  it("is exposed publicly, and is not a list column", () => {
    expect(articleContentType.publicApi.fields).toContain("gallery");
    expect(articleContentType.admin.list.columns).not.toContain("gallery");
  });
});
