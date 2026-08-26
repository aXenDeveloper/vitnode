import { describe, expect, it } from "vitest";

import { sanitizeFolder } from "../lib/api/upload";
import {
  fileAcceptAttribute,
  fileFormatLabels,
  validateFile,
} from "../lib/file-constraints";
import { formatBytes } from "../lib/format-bytes";
import { defineContentType } from "./define";
import { field } from "./fields";
import {
  assertContentFileMaxBytes,
  contentFileAccept,
  contentFileConstraints,
  contentFileFolder,
  contentFileFormatLabels,
  normalizeContentFileExtension,
  normalizeContentFileExtensions,
  normalizeContentFileMimeTypes,
  validateContentFile,
} from "./files";

const gif = {
  allowedExtensions: [".gif"],
  allowedMimeTypes: ["image/gif"],
  maxBytes: 10 * 1024 * 1024,
};

describe("field.file - maxBytes", () => {
  it("is required at definition time", () => {
    // `field.file({})` is a compile error too - `maxBytes` is not optional on the
    // argument type - so this is the JavaScript caller and the widened value.
    expect(() => field.file({} as unknown as { maxBytes: number })).toThrow(
      /needs `maxBytes`/,
    );
  });

  it("rejects zero and negative ceilings", () => {
    for (const maxBytes of [0, -1, -1024]) {
      expect(() => field.file({ maxBytes })).toThrow(
        /must be greater than zero/,
      );
    }
  });

  it("rejects a non-integer or non-finite ceiling", () => {
    expect(() => field.file({ maxBytes: 1.5 })).toThrow(
      /not a whole number of bytes/,
    );
    expect(() => field.file({ maxBytes: Number.POSITIVE_INFINITY })).toThrow(
      /needs `maxBytes`/,
    );
    expect(() => field.file({ maxBytes: Number.NaN })).toThrow(
      /needs `maxBytes`/,
    );
  });

  it("accepts a positive integer and stores it verbatim", () => {
    expect(field.file({ maxBytes: 5 * 1024 * 1024 }).maxBytes).toBe(5_242_880);
    expect(assertContentFileMaxBytes(1)).toBe(1);
  });

  it("leaves no way to declare an unlimited file field", () => {
    // Every route out is covered above; this states the intent so a future
    // `maxBytes?: number` has to delete a test rather than slip through.
    const descriptor = field.file({ maxBytes: 1 });

    expect(typeof descriptor.maxBytes).toBe("number");
    expect(descriptor.maxBytes).toBeGreaterThan(0);
  });
});

describe("field.file - nullability", () => {
  it("defaults to nullable, because a record may not have a file yet", () => {
    expect(field.file({ maxBytes: 1 }).nullable).toBe(true);
    expect(field.file({ maxBytes: 1 }).required).toBe(false);
  });

  it("is refused when neither required nor nullable", () => {
    expect(() =>
      defineContentType({
        id: "example.no-fallback",
        tableName: "example_no_fallback",
        fields: {
          title: field.text({ required: true }),
          cover: field.file({ maxBytes: 1, nullable: false }),
        },
      }),
    ).toThrow(/neither required nor nullable/);
  });
});

describe("allowedExtensions normalization", () => {
  it("folds .gif, GIF and .GIF onto one rule", () => {
    expect(normalizeContentFileExtension(".gif")).toBe(".gif");
    expect(normalizeContentFileExtension("GIF")).toBe(".gif");
    expect(normalizeContentFileExtension(".Gif")).toBe(".gif");
    expect(normalizeContentFileExtension("  .GIF  ")).toBe(".gif");
  });

  it("deduplicates the folded rules", () => {
    expect(normalizeContentFileExtensions(["GIF", ".gif", ".Gif"])).toEqual([
      ".gif",
    ]);
  });

  it("keeps declaration order", () => {
    expect(
      field.file({
        maxBytes: 1,
        allowedExtensions: [".JPG", "jpeg", ".png"],
      }).allowedExtensions,
    ).toEqual([".jpg", ".jpeg", ".png"]);
  });

  it("rejects an empty string, a bare dot and whitespace", () => {
    for (const value of ["", ".", "   ", "..", ". "]) {
      expect(() => normalizeContentFileExtension(value)).toThrow(
        /not a file extension/,
      );
    }
  });

  it("rejects a compound extension, which would match nothing", () => {
    // `getFileExtension("archive.tar.gz")` is `.gz`, so a `.tar.gz` rule would be
    // an allowlist that silently refuses every file.
    expect(() => normalizeContentFileExtension(".tar.gz")).toThrow(
      /not a file extension/,
    );
  });

  it("rejects anything that is not a string", () => {
    for (const value of [1, null, undefined, {}, ["a"]]) {
      expect(() => normalizeContentFileExtension(value)).toThrow(
        /must be a string/,
      );
    }
  });

  it("rejects an empty list, which would refuse every file", () => {
    expect(() => normalizeContentFileExtensions([])).toThrow(
      /would refuse every file/,
    );
    expect(() => field.file({ maxBytes: 1, allowedExtensions: [] })).toThrow(
      /would refuse every file/,
    );
  });

  it("leaves the option absent when it is not declared", () => {
    expect(field.file({ maxBytes: 1 }).allowedExtensions).toBeUndefined();
  });
});

describe("allowedMimeTypes normalization", () => {
  it("lowercases and trims", () => {
    expect(normalizeContentFileMimeTypes([" Image/GIF "])).toEqual([
      "image/gif",
    ]);
  });

  it("rejects wildcards, parameters and malformed types", () => {
    for (const value of [
      "image/*",
      "*/*",
      "image",
      "image/gif; charset=utf-8",
      "",
      "/gif",
      "image/",
    ]) {
      expect(() => normalizeContentFileMimeTypes([value])).toThrow(
        /not a media type/,
      );
    }
  });

  it("rejects an empty list", () => {
    expect(() => normalizeContentFileMimeTypes([])).toThrow(
      /would refuse every file/,
    );
  });
});

describe("validateContentFile", () => {
  it("accepts a file that satisfies every rule", () => {
    expect(
      validateContentFile(gif, {
        mimeType: "image/gif",
        name: "banner.gif",
        size: 1024,
      }),
    ).toBeNull();
  });

  it("refuses a file over maxBytes", () => {
    const rejection = validateContentFile(gif, {
      mimeType: "image/gif",
      name: "banner.gif",
      size: gif.maxBytes + 1,
    });

    expect(rejection?.code).toBe("CONTENT_FILE_TOO_LARGE");
    // The message carries both sizes in human units, because "10485760 bytes" is
    // not a sentence anybody can act on.
    expect(rejection?.message).toContain("10 MB");
  });

  it("accepts a file exactly at maxBytes", () => {
    expect(
      validateContentFile(gif, {
        mimeType: "image/gif",
        name: "banner.gif",
        size: gif.maxBytes,
      }),
    ).toBeNull();
  });

  it("refuses a disallowed media type", () => {
    expect(
      validateContentFile(gif, {
        mimeType: "image/png",
        name: "banner.gif",
        size: 10,
      })?.code,
    ).toBe("CONTENT_FILE_MIME_TYPE_NOT_ALLOWED");
  });

  it("refuses a disallowed extension", () => {
    expect(
      validateContentFile(gif, {
        mimeType: "image/gif",
        name: "banner.png",
        size: 10,
      })?.code,
    ).toBe("CONTENT_FILE_EXTENSION_NOT_ALLOWED");
  });

  /**
   * The case an extension-only check waves through, and the reason a strict field
   * states both lists: a PNG renamed to `.gif` still declares `image/png`.
   */
  it("refuses a file whose extension matches but whose media type does not", () => {
    expect(
      validateContentFile(gif, {
        mimeType: "image/png",
        name: "picture.gif",
        size: 10,
      })?.code,
    ).toBe("CONTENT_FILE_MIME_TYPE_NOT_ALLOWED");
  });

  it("refuses a file whose media type matches but whose extension does not", () => {
    expect(
      validateContentFile(gif, {
        mimeType: "image/gif",
        name: "picture.png",
        size: 10,
      })?.code,
    ).toBe("CONTENT_FILE_EXTENSION_NOT_ALLOWED");
  });

  it("compares case-insensitively on both sides", () => {
    expect(
      validateContentFile(gif, {
        mimeType: "IMAGE/GIF",
        name: "BANNER.GIF",
        size: 10,
      }),
    ).toBeNull();
  });

  it("treats a missing media type as not allowed when a list is declared", () => {
    expect(
      validateContentFile(gif, {
        mimeType: null,
        name: "banner.gif",
        size: 10,
      })?.code,
    ).toBe("CONTENT_FILE_MIME_TYPE_NOT_ALLOWED");
  });

  it("checks only what is declared", () => {
    // Size alone: any name, any type.
    const sizeOnly = { maxBytes: 100 };

    expect(
      validateContentFile(sizeOnly, {
        mimeType: null,
        name: "whatever",
        size: 100,
      }),
    ).toBeNull();
    expect(
      validateContentFile(sizeOnly, {
        mimeType: null,
        name: "whatever",
        size: 101,
      })?.code,
    ).toBe("CONTENT_FILE_TOO_LARGE");
  });
});

describe("contentFileFolder", () => {
  it("groups uploads by plugin and module", () => {
    expect(
      contentFileFolder({ module: "posts", pluginId: "@vitnode/blog" }),
    ).toBe("vitnode-blog/posts");
  });

  it("turns a package name into one folder segment", () => {
    // A plugin id is a package name, so it carries the two characters a segment
    // may not: the scope's `@` and the `/` after it.
    for (const [pluginId, expected] of [
      ["@vitnode/blog", "vitnode-blog"],
      ["@My-Org/Some.Plugin", "my-org-some-plugin"],
      ["plain", "plain"],
      ["@scope/", "scope"],
    ] as const) {
      expect(contentFileFolder({ module: "m", pluginId })).toBe(
        `${expected}/m`,
      );
    }
  });

  it("is a folder `sanitizeFolder` accepts", () => {
    // The two have to agree or every upload fails at the adapter: this is the
    // caller, and that is the guard the storage model runs on what it is handed.
    expect(
      sanitizeFolder(
        contentFileFolder({
          module: "file_post",
          pluginId: "@vitnode/example",
        }),
      ),
    ).toBe("vitnode-example/file_post");
  });

  it("refuses a plugin id that cannot name anything", () => {
    expect(() => contentFileFolder({ module: "m", pluginId: "@/" })).toThrow(
      /cannot name a storage folder/,
    );
  });
});

describe("contentFileAccept", () => {
  it("lists extensions and media types together", () => {
    expect(contentFileAccept(gif)).toBe(".gif,image/gif");
  });

  it("is undefined when the field constrains neither", () => {
    expect(contentFileAccept({ maxBytes: 1 })).toBeUndefined();
  });

  it("is built from the same descriptor the server validates against", () => {
    const descriptor = field.file({
      maxBytes: 10,
      allowedExtensions: ["GIF"],
      allowedMimeTypes: ["Image/GIF"],
    });

    expect(contentFileAccept(contentFileConstraints(descriptor))).toBe(
      ".gif,image/gif",
    );
  });
});

describe("one implementation of the rules", () => {
  /**
   * The drift guard for requirement "the UI constraints come from the same field
   * spec the server validates against".
   *
   * `AutoFormFile` imports `lib/file-constraints` and the Content Engine
   * re-exports the very same functions, so a rule cannot be changed on one side.
   * Identity, not behaviour: a second implementation that happened to agree today
   * is exactly what this exists to refuse.
   */
  it("shares the accept and format helpers with the form field", () => {
    expect(contentFileAccept).toBe(fileAcceptAttribute);
    expect(contentFileFormatLabels).toBe(fileFormatLabels);
  });

  it("maps the shared rejection reason onto the engine's own code", () => {
    const shared = validateFile(gif, {
      mimeType: "image/png",
      name: "x.gif",
      size: 1,
    });
    const content = validateContentFile(gif, {
      mimeType: "image/png",
      name: "x.gif",
      size: 1,
    });

    expect(shared?.reason).toBe("mimeType");
    expect(content?.code).toBe("CONTENT_FILE_MIME_TYPE_NOT_ALLOWED");
    // Same sentence, so the browser and the API tell the same story.
    expect(content?.message).toBe(shared?.message);
  });
});

describe("human-readable sizes", () => {
  /** The units the constraint line actually shows people. */
  it("reads as the field author wrote it", () => {
    expect(formatBytes(512 * 1024)).toBe("512 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5 MB");
    expect(formatBytes(20 * 1024 * 1024)).toBe("20 MB");
    expect(formatBytes(1024 * 1024 * 1024)).toBe("1 GB");
  });
});

describe("contentFileFormatLabels", () => {
  it("prefers extensions, uppercased and dot-free", () => {
    expect(
      contentFileFormatLabels({
        allowedExtensions: [".jpg", ".jpeg", ".png", ".webp", ".avif"],
        allowedMimeTypes: ["image/jpeg", "image/png"],
        maxBytes: 1,
      }),
    ).toEqual(["JPG", "JPEG", "PNG", "WEBP", "AVIF"]);
  });

  it("never shows a raw media type when it has an extension to show", () => {
    const labels = contentFileFormatLabels({
      allowedExtensions: [".pdf"],
      allowedMimeTypes: ["application/pdf"],
      maxBytes: 1,
    });

    expect(labels).toEqual(["PDF"]);
    expect(labels.join(",")).not.toContain("/");
  });

  it("falls back to the media subtype when there are no extensions", () => {
    expect(
      contentFileFormatLabels({
        allowedMimeTypes: ["application/pdf", "image/gif"],
        maxBytes: 1,
      }),
    ).toEqual(["PDF", "GIF"]);
  });

  it("is empty when the field constrains neither", () => {
    expect(contentFileFormatLabels({ maxBytes: 1 })).toEqual([]);
  });
});
