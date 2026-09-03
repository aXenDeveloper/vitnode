// Node, not jsdom: a real `FormData` with a real `File` in it only survives the
// trip through `app.request` under Node's own multipart implementation - jsdom's
// globals produce "Malformed FormData".
// @vitest-environment node
import type { Context, MiddlewareHandler } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StorageImageUnprocessableError } from "@/api/models/storage";
import {
  testFilePostContentType,
  testPostContentType,
} from "@/tests/content-fixtures";

import { createContentModel } from "./model";
import { buildContentRoutes } from "./routes";

const permissions = { create: true, edit: true, view: true };

vi.mock("../../api/lib/check-staff-permission", () => ({
  assertStaffPermission: async () => {
    await Promise.resolve();
  },
  checkStaffPermission: async (
    _c: unknown,
    { permission }: { permission: string },
  ) =>
    await Promise.resolve(
      permission === "can_create"
        ? permissions.create
        : permission === "can_edit"
          ? permissions.edit
          : permissions.view,
    ),
}));

const files = createContentModel(testFilePostContentType);
const plain = createContentModel(testPostContentType, {
  references: {
    category: () => createContentModel(testPostContentType).table.id,
  },
});

const PLUGIN_ID = "@vitnode/example";

const harness = ({
  storageThrows,
  storedAs,
  storedMimeType,
  storedSize,
}: {
  /** Mimics `StorageModel`, which speaks in `HTTPException`s. */
  storageThrows?: HTTPException;
  storedAs?: string;
  storedMimeType?: string;
  storedSize?: number;
} = {}) => {
  const upload = vi.fn(async ({ file }: { file: File }) => {
    if (storageThrows) throw storageThrows;

    return await Promise.resolve({
      dimensions: { height: 900, width: 1600 },
      id: 42,
      key: "month_8_2026/content/42",
      mimeType: storedMimeType ?? (file.type === "" ? null : file.type),
      name: storedAs ?? file.name,
      size: storedSize ?? file.size,
      url: "https://cdn.test/month_8_2026/content/42",
    });
  });
  const deleteFile = vi.fn().mockResolvedValue(undefined);

  const app = new OpenAPIHono();
  const middleware: MiddlewareHandler = async (c, next) => {
    c.set("storage", {
      deleteFile,
      upload,
    } as unknown as Context["var"]["storage"]);
    c.set("admin", { user: { id: 1 } } as unknown as Context["var"]["admin"]);
    await next();
  };
  app.use("*", middleware);

  for (const { handler, route } of buildContentRoutes(files, {
    pluginId: PLUGIN_ID,
  })) {
    app.openapi(route, handler);
  }

  return { app, deleteFile, upload };
};

const post = async (
  app: OpenAPIHono,
  field: string,
  file: File,
): Promise<Response> => {
  const body = new FormData();
  body.append("file", file);

  return await app.request(`/uploads/${field}`, { body, method: "POST" });
};

const fileOf = (name: string, type: string, bytes = 8): File =>
  new File([new Uint8Array(bytes)], name, { type });

describe("the generated upload route", () => {
  beforeEach(() => {
    permissions.create = true;
    permissions.edit = true;
    permissions.view = true;
  });

  it("is not mounted for a content type with no file field", () => {
    const paths = buildContentRoutes(plain, { pluginId: PLUGIN_ID }).map(
      entry => `${entry.route.method} ${entry.route.path}`,
    );

    expect(paths.some(path => path.includes("/uploads/"))).toBe(false);
  });

  it("is mounted once, addressed by field, for a content type with three", () => {
    const uploads = buildContentRoutes(files, { pluginId: PLUGIN_ID }).filter(
      entry => entry.route.path.includes("/uploads/"),
    );

    expect(uploads).toHaveLength(1);
    expect(uploads[0].route.path).toBe("/uploads/{field}");
    expect(uploads[0].route.method).toBe("post");
  });

  it("stores a GIF for the GIF-only field and returns its descriptor", async () => {
    const { app, upload } = harness();

    const res = await post(app, "animation", fileOf("banner.gif", "image/gif"));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      height: 900,
      id: 42,
      mimeType: "image/gif",
      name: "banner.gif",
      size: 8,
      url: "https://cdn.test/month_8_2026/content/42",
      width: 1600,
    });
    // The field's own ceiling and allowlist reach the adapter too, and the file
    // lands under its owner rather than in one flat pile: `{plugin}/{module}`, so
    // a bucket listing says which plugin and which content type an object
    // belongs to without a join back to `core_files`.
    expect(upload.mock.calls[0][0]).toMatchObject({
      allowedMimeTypes: ["image/gif"],
      folder: "vitnode-example/file_post",
      maxBytes: 10 * 1024 * 1024,
    });
  });

  it("refuses a PNG for the GIF-only field before uploading anything", async () => {
    const { app, upload } = harness();

    const res = await post(app, "animation", fileOf("shot.png", "image/png"));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      code: "CONTENT_FILE_MIME_TYPE_NOT_ALLOWED",
    });
    expect(upload).not.toHaveBeenCalled();
  });

  /**
   * The case an extension-only check waves through: the file is *called* `.gif`
   * and the browser still declares what it is.
   */
  it("refuses a PNG renamed to .gif, because the media type is wrong", async () => {
    const { app, upload } = harness();

    const res = await post(
      app,
      "animation",
      fileOf("renamed.gif", "image/png"),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      code: "CONTENT_FILE_MIME_TYPE_NOT_ALLOWED",
    });
    expect(upload).not.toHaveBeenCalled();
  });

  it("refuses a real GIF whose extension is wrong", async () => {
    const { app, upload } = harness();

    const res = await post(app, "animation", fileOf("banner.png", "image/gif"));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      code: "CONTENT_FILE_EXTENSION_NOT_ALLOWED",
    });
    expect(upload).not.toHaveBeenCalled();
  });

  it("refuses a GIF over 10 MB without spending the bandwidth", async () => {
    const { app, upload } = harness();

    const res = await post(
      app,
      "animation",
      fileOf("huge.gif", "image/gif", 10 * 1024 * 1024 + 1),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      code: "CONTENT_FILE_TOO_LARGE",
    });
    expect(upload).not.toHaveBeenCalled();
  });

  it("accepts a PDF for the PDF field and a JPG for the image field", async () => {
    const { app } = harness();

    await expect(
      post(app, "document", fileOf("spec.pdf", "application/pdf")).then(
        res => res.status,
      ),
    ).resolves.toBe(200);
    await expect(
      post(app, "cover", fileOf("hero.jpg", "image/jpeg")).then(
        res => res.status,
      ),
    ).resolves.toBe(200);
  });

  it("refuses a PDF for the image field", async () => {
    const { app } = harness();

    const res = await post(app, "cover", fileOf("spec.pdf", "application/pdf"));

    expect(res.status).toBe(400);
  });

  it("refuses a field that is not a file field", async () => {
    const { app, upload } = harness();

    for (const field of ["title", "slug", "nope"]) {
      const res = await post(app, field, fileOf("x.gif", "image/gif"));

      expect(res.status).toBe(400);
    }
    expect(upload).not.toHaveBeenCalled();
  });

  /**
   * With `storage.image` configured, VitNode re-encodes images to WebP - so a
   * `.png` upload is *stored* as `.webp`. A field that allows only `.gif` (or
   * only `.png`) has to hear about that now rather than at save time, and the
   * file this request created is removed on the way out.
   */
  it("refuses and deletes a file the storage pipeline converted out of the allowlist", async () => {
    const { app, deleteFile } = harness({
      storedAs: "banner.webp",
      storedMimeType: "image/webp",
    });

    const res = await post(app, "animation", fileOf("banner.gif", "image/gif"));

    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string; message: string };
    expect(body.code).toBe("CONTENT_FILE_MIME_TYPE_NOT_ALLOWED");
    expect(body.message).toContain("banner.webp");
    expect(body.message).toContain("re-encodes");
    expect(body.message).toContain("original format");
    expect(deleteFile).toHaveBeenCalledWith(42);
  });

  it("accepts a PNG converted to WebP when the field allows WebP", async () => {
    const { app, deleteFile } = harness({
      storedAs: "hero.webp",
      storedMimeType: "image/webp",
    });

    const res = await post(app, "cover", fileOf("hero.png", "image/png"));

    expect(res.status).toBe(200);
    expect(deleteFile).not.toHaveBeenCalled();
  });

  it("refuses a stored file that came back larger than the ceiling", async () => {
    const { app, deleteFile } = harness({ storedSize: 6 * 1024 * 1024 });

    const res = await post(app, "cover", fileOf("hero.jpg", "image/jpeg"));

    expect(res.status).toBe(400);
    expect(deleteFile).toHaveBeenCalledWith(42);
  });

  /**
   * Every refusal has to arrive as JSON.
   *
   * Hono renders an `HTTPException`'s message as plain text, and the browser
   * cannot tell that from a proxy's HTML error page - so a bare exception here
   * became "The upload failed. Please try again." in the AdminCP, which told the
   * editor nothing and invited them to retry a misconfiguration.
   */
  describe("the shape of a refusal", () => {
    const bodyOf = async (res: Response) =>
      (await res.json()) as { code?: string; message?: string };

    it("names the field when the URL does not name a file field", async () => {
      const { app } = harness();

      const res = await post(app, "title", fileOf("x.gif", "image/gif"));
      const body = await bodyOf(res);

      expect(res.status).toBe(400);
      expect(body.code).toBe("CONTENT_FILE_FIELD_UNKNOWN");
      expect(body.message).toContain("title");
    });

    it("says which permission is missing rather than just Forbidden", async () => {
      permissions.create = false;
      permissions.edit = false;
      const { app } = harness();

      const res = await post(app, "animation", fileOf("a.gif", "image/gif"));
      const body = await bodyOf(res);

      expect(res.status).toBe(403);
      expect(body.code).toBe("CONTENT_FILE_FORBIDDEN");
      expect(body.message).toMatch(/permission/i);
    });

    it("passes a corrupt-image failure through with its own words", async () => {
      const { app } = harness({
        storageThrows: new HTTPException(400, {
          message: "Invalid or corrupt image file",
        }),
      });

      const res = await post(app, "cover", fileOf("hero.jpg", "image/jpeg"));
      const body = await bodyOf(res);

      expect(res.status).toBe(400);
      expect(body.code).toBe("CONTENT_FILE_INVALID");
      expect(body.message).toBe("Invalid or corrupt image file");
    });

    it("separates an unconvertible image from a corrupt one", async () => {
      const { app } = harness({
        storageThrows: new StorageImageUnprocessableError(
          "This image is 20000\u00d7400 pixels, which is too large to convert to WEBP. WEBP allows at most 16383 pixels per side. Resize it and upload it again.",
        ),
      });

      const res = await post(app, "cover", fileOf("hero.jpg", "image/jpeg"));
      const body = await bodyOf(res);

      expect(res.status).toBe(400);
      expect(body.code).toBe("CONTENT_FILE_UNPROCESSABLE");
      expect(body.message).toContain("16383");
    });

    it("says the install cannot store anything, and which way", async () => {
      // The case an editor would otherwise retry for ever: nothing is wrong with
      // their file.
      for (const message of [
        "Storage provider not found",
        "Image optimization library (sharp) failed to load",
      ]) {
        const { app } = harness({
          storageThrows: new HTTPException(500, { message }),
        });

        const res = await post(app, "cover", fileOf("hero.jpg", "image/jpeg"));
        const body = await bodyOf(res);

        expect(res.status).toBe(500);
        expect(body.code).toBe("CONTENT_FILE_STORAGE_UNAVAILABLE");
        expect(body.message).toBe(message);
      }
    });

    it("answers JSON for every refusal, never bare text", async () => {
      const cases: (() => Promise<Response>)[] = [
        async () =>
          await post(harness().app, "title", fileOf("a.gif", "image/gif")),
        async () =>
          await post(
            harness().app,
            "cover",
            fileOf("spec.pdf", "application/pdf"),
          ),
        async () =>
          await post(
            harness({
              storageThrows: new HTTPException(500, { message: "nope" }),
            }).app,
            "cover",
            fileOf("hero.jpg", "image/jpeg"),
          ),
      ];

      for (const run of cases) {
        const res = await run();

        expect(res.ok).toBe(false);
        // `.json()` rejecting is exactly what produced the generic message.
        await expect(res.json()).resolves.toMatchObject({
          code: expect.any(String),
          message: expect.any(String),
        });
      }
    });
  });

  describe("permissions", () => {
    it("accepts a role that may only create", async () => {
      permissions.edit = false;
      const { app } = harness();

      await expect(
        post(app, "animation", fileOf("a.gif", "image/gif")).then(
          res => res.status,
        ),
      ).resolves.toBe(200);
    });

    it("accepts a role that may only edit", async () => {
      permissions.create = false;
      const { app } = harness();

      await expect(
        post(app, "animation", fileOf("a.gif", "image/gif")).then(
          res => res.status,
        ),
      ).resolves.toBe(200);
    });

    it("refuses a read-only role", async () => {
      permissions.create = false;
      permissions.edit = false;
      const { app, upload } = harness();

      const res = await post(app, "animation", fileOf("a.gif", "image/gif"));

      expect(res.status).toBe(403);
      expect(upload).not.toHaveBeenCalled();
    });
  });
});
