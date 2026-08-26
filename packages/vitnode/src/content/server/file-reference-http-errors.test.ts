// @vitest-environment node
import type { Context, MiddlewareHandler } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { testFilePostContentType } from "@/tests/content-fixtures";

import { CONTENT_FILE_CODES } from "../const";
import { defineContentType } from "../define";
import { ContentInputError } from "../errors";
import { field } from "../fields";
import { ContentFileReferenceError } from "./files";
import { buildContentLocalizedAdminRoutes } from "./localized-admin-routes";
import { createContentModel } from "./model";
import { buildContentRoutes } from "./routes";

vi.mock("../../api/lib/check-staff-permission", () => ({
  assertStaffPermission: async () => {
    await Promise.resolve();
  },
  checkStaffPermission: async () => await Promise.resolve(true),
}));

/**
 * The composite half of the contract needs a content type that is **both**
 * localized and holds a file, which no shared fixture is - a file field is
 * always shared, so this is the one combination that exercises a save writing
 * the base row and its translations in one transaction while carrying a file
 * identifier.
 */
const localizedFileContentType = defineContentType({
  id: "test.localized-file",
  tableName: "test_localized_files",
  localization: { enabled: true, defaultLocale: "en", fallback: "default" },
  fields: {
    title: field.text({ localized: true, required: true, maxLength: 200 }),
    slug: field.slug({ localized: true, source: "title" }),
    cover: field.file({
      maxBytes: 5 * 1024 * 1024,
      allowedExtensions: [".png"],
      allowedMimeTypes: ["image/png"],
    }),
  },
  admin: {
    titleField: "title",
    list: { columns: ["cover"] },
  },
});

const filePosts = createContentModel(testFilePostContentType);
const localizedFiles = createContentModel(localizedFileContentType);

const PLUGIN_ID = "@vitnode/example";

const adminUser = {
  avatarColor: "000000",
  birthday: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  email: "test@test.com",
  emailVerified: true,
  id: 1,
  language: "en",
  name: "Test",
  nameCode: "test",
  newsletter: false,
  roleId: 1,
};

/**
 * The rejection the reference check raises, as the service raises it.
 *
 * Constructed rather than provoked through a stubbed `core_files` read: what is
 * under test is the boundary between the error and the response, and the four
 * codes are already validated against real descriptors in `files.test.ts`.
 */
const rejection = (
  code: (typeof CONTENT_FILE_CODES)[keyof typeof CONTENT_FILE_CODES],
  field_: string,
  message: string,
) =>
  new ContentFileReferenceError({
    code,
    contentTypeId: "test.file-post",
    field: field_,
    message,
  });

/**
 * The real `app.onError`, copied from `VitNodeAPI`.
 *
 * The point of a structured 400 is that `HTTPException.getResponse()` survives
 * the trip out, so the handler that has to return it verbatim is part of what is
 * being tested - asserting on `getResponse()` alone would pass even if the app
 * flattened the body on the way out.
 */
const withErrorHandler = (app: OpenAPIHono): OpenAPIHono => {
  app.onError((error, c) => {
    if (error instanceof HTTPException) return error.getResponse();

    return c.text("Internal Server Error", 500);
  });

  return app;
};

/** The generated admin routes over a service that throws whatever is given. */
const harness = () => {
  const service = {
    advanced: vi.fn().mockResolvedValue({}),
    advancedFields: vi.fn().mockResolvedValue({}),
    create: vi.fn(),
    delete: vi.fn(),
    findById: vi.fn(),
    findDetail: vi.fn(),
    findMany: vi.fn(),
    findRowById: vi.fn().mockResolvedValue({ id: 7 }),
    options: vi.fn(),
    publish: vi.fn(),
    relations: {},
    repeatable: {},
    unpublish: vi.fn(),
    update: vi.fn(),
  };

  vi.spyOn(filePosts, "service").mockReturnValue(service);

  const app = withErrorHandler(new OpenAPIHono());
  const context: MiddlewareHandler = async (c, next) => {
    c.set("admin", { user: adminUser } as unknown as Context["var"]["admin"]);
    c.set("events", {
      emit: async () => await Promise.resolve({ failures: [], listeners: 0 }),
    } as unknown as Context["var"]["events"]);
    c.set("db", {
      select: () => ({
        from: () => ({ where: async () => await Promise.resolve([]) }),
      }),
    } as unknown as Context["var"]["db"]);
    await next();
  };
  app.use("*", context);

  for (const { handler, route } of buildContentRoutes(filePosts, {
    pluginId: PLUGIN_ID,
  })) {
    app.openapi(route, handler);
  }

  return { app, service };
};

/** The composite pair over a stubbed service, inside a stubbed transaction. */
const localizedHarness = () => {
  const service = {
    advanced: vi.fn().mockResolvedValue({}),
    advancedFields: vi.fn().mockResolvedValue({}),
    create: vi.fn(),
    findById: vi.fn().mockResolvedValue({ id: 7, version: 3 }),
    findRowById: vi.fn().mockResolvedValue({ id: 7, version: 3 }),
    relations: {},
    repeatable: {},
    update: vi.fn(),
  };
  const translations = {
    create: vi.fn(),
    findManyForItem: vi.fn().mockResolvedValue([]),
    findManyRowsForItem: vi.fn().mockResolvedValue([]),
    update: vi.fn(),
  };

  vi.spyOn(localizedFiles, "service").mockReturnValue(service as never);
  vi.spyOn(
    localizedFiles as unknown as { translationService: unknown },
    "translationService",
    "get",
  ).mockReturnValue(() => translations);

  const app = withErrorHandler(new OpenAPIHono());
  const context: MiddlewareHandler = async (c, next) => {
    c.set("admin", { user: adminUser } as unknown as Context["var"]["admin"]);
    c.set("events", {
      emit: async () => await Promise.resolve({ failures: [], listeners: 0 }),
    } as unknown as Context["var"]["events"]);
    c.set("db", {
      transaction: async (run: (handle: unknown) => Promise<unknown>) =>
        await run({}),
    } as unknown as Context["var"]["db"]);
    await next();
  };
  app.use("*", context);

  for (const { handler, route } of buildContentLocalizedAdminRoutes(
    localizedFiles,
    { pluginId: PLUGIN_ID },
  )) {
    app.openapi(route, handler);
  }

  return { app, service };
};

const send = async (
  app: OpenAPIHono,
  path: string,
  method: string,
  body: unknown,
): Promise<{ body: unknown; contentType: null | string; status: number }> => {
  const response = await app.request(path, {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method,
  });
  const text = await response.text();

  return {
    body: ((): unknown => {
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    })(),
    contentType: response.headers.get("content-type"),
    status: response.status,
  };
};

beforeEach(() => {
  vi.restoreAllMocks();
});

/**
 * A refused file identifier has to reach the client as `{ code, field, message }`.
 *
 * `ContentFileReferenceError` extends `ContentInputError`, and the generic branch
 * of the mapper answers a `ContentInputError` with `message` alone - so before
 * this, every one of the four reasons arrived as prose with no code and, worse,
 * no field. A save carries every field at once: without `field` a form knows a
 * file was refused and cannot say which input to put the message under.
 */
describe("a refused file identifier on a content write", () => {
  const cases = [
    [
      CONTENT_FILE_CODES.missing,
      "cover",
      'File 99 does not exist, so "cover" cannot point at it.',
    ],
    [
      CONTENT_FILE_CODES.size,
      "cover",
      'File 42 cannot be used for "cover": This file is 8 MB. The maximum is 5 MB.',
    ],
    [
      CONTENT_FILE_CODES.mimeType,
      "animation",
      'File 42 cannot be used for "animation": "image/png" is not an accepted file type. Accepted: image/gif.',
    ],
    [
      CONTENT_FILE_CODES.extension,
      "document",
      'File 42 cannot be used for "document": ".png" is not an accepted file extension. Accepted: .pdf.',
    ],
  ] as const;

  describe.each(cases)("%s", (code, fieldName, message) => {
    it("is a structured 400 on create", async () => {
      const { app, service } = harness();
      service.create.mockRejectedValue(rejection(code, fieldName, message));

      const response = await send(app, "/", "POST", {
        title: "Hello",
        slug: "hello",
      });

      expect(response.status).toBe(400);
      expect(response.contentType).toContain("application/json");
      expect(response.body).toEqual({ code, field: fieldName, message });
    });

    it("is a structured 400 on update", async () => {
      const { app, service } = harness();
      service.update.mockRejectedValue(rejection(code, fieldName, message));

      const response = await send(app, "/7", "PUT", { title: "Hello" });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ code, field: fieldName, message });
    });
  });

  it("names the field for a composite create", async () => {
    const { app, service } = localizedHarness();
    service.create.mockRejectedValue(
      rejection(CONTENT_FILE_CODES.mimeType, "cover", "Not a PNG."),
    );

    const response = await send(app, "/localized", "POST", {
      translations: [{ locale: "en", values: { slug: "hello", title: "Hi" } }],
      values: { cover: 42 },
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      code: "CONTENT_FILE_MIME_TYPE_NOT_ALLOWED",
      field: "cover",
      message: "Not a PNG.",
    });
  });

  it("names the field for a composite update", async () => {
    const { app, service } = localizedHarness();
    service.update.mockRejectedValue(
      rejection(CONTENT_FILE_CODES.size, "cover", "Too big."),
    );

    const response = await send(app, "/7/localized", "PUT", {
      expectedVersion: 3,
      translations: [],
      values: { cover: 42 },
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      code: "CONTENT_FILE_TOO_LARGE",
      field: "cover",
      message: "Too big.",
    });
  });

  /**
   * `Error.message` carries `[Content Engine] <contentTypeId>: ` for the log's
   * benefit, and an editor must never be shown it. The body reads `detail`, so
   * this is the assertion that keeps it reading `detail`.
   */
  it("keeps the internal prefix and the content type id out of the body", async () => {
    const { app, service } = harness();
    service.create.mockRejectedValue(
      rejection(CONTENT_FILE_CODES.size, "cover", "This file is too big."),
    );

    const response = await send(app, "/", "POST", {
      title: "Hello",
      slug: "hello",
    });

    expect(JSON.stringify(response.body)).not.toContain("Content Engine");
    expect(JSON.stringify(response.body)).not.toContain("test.file-post");
    expect(response.body).toMatchObject({ message: "This file is too big." });
  });

  /**
   * The guard on the branch above it: only a file rejection gains a body. Every
   * other `ContentInputError` keeps the plain-text 400 it has always answered,
   * so no existing client starts reading JSON where there is none.
   */
  it("leaves every other input error as plain text", async () => {
    const { app, service } = harness();
    service.create.mockRejectedValue(
      new ContentInputError("Provide the slug explicitly."),
    );

    const response = await send(app, "/", "POST", {
      title: "Hello",
      slug: "hello",
    });

    expect(response.status).toBe(400);
    expect(response.body).toBe("[Content Engine] Provide the slug explicitly.");
  });
});

describe("the OpenAPI contract for that 400", () => {
  /**
   * The declared 400 body of one generated route.
   *
   * The model is taken as `never` because `buildContentRoutes` is invariant in
   * its definition: a concrete `ContentModel` is not assignable to the
   * `AnyContentTypeDefinition` its parameter names, and every call site here has
   * a concrete one.
   */
  const body400 = (model: never, method: string, path: string) => {
    const entry = buildContentRoutes(model, { pluginId: PLUGIN_ID }).find(
      item => item.route.method === method && item.route.path === path,
    );

    return (
      entry?.route.responses?.[400] as
        undefined | { content?: Record<string, { schema: unknown }> }
    )?.content?.["application/json"]?.schema;
  };

  it("declares the JSON body on create and update", () => {
    expect(body400(filePosts as never, "post", "/")).toBeDefined();
    expect(body400(filePosts as never, "put", "/{id}")).toBeDefined();
  });

  it("declares it on the composite pair", () => {
    expect(
      body400(localizedFiles as never, "post", "/localized"),
    ).toBeDefined();
    expect(
      body400(localizedFiles as never, "put", "/{id}/localized"),
    ).toBeDefined();
  });

  /**
   * A content type with no file field cannot produce this body, so it must not
   * advertise one - the same rule `uniqueConflict` follows for a non-editorial
   * content type.
   */
  it("says nothing about it for a content type with no file field", async () => {
    const { testPostContentType } = await import("@/tests/content-fixtures");
    const plain = createContentModel(testPostContentType, {
      references: { category: () => filePosts.table.id },
    });

    expect(body400(plain as never, "post", "/")).toBeUndefined();
  });
});
