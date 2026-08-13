// @vitest-environment node
import type { RouteConfig } from "@hono/zod-openapi";
import type { MiddlewareHandler } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { JsonSchemaLike } from "@/tests/openapi-validate";

import {
  testDeliveredPostContentType,
  testEditorialPostContentType,
  testLocalizedPageContentType,
} from "@/tests/content-fixtures";
import { validateAgainstJsonSchema } from "@/tests/openapi-validate";

import {
  ContentDefaultTranslationRequired,
  ContentDeliverySlugReserved,
  ContentRevisionNotRestorable,
  ContentScheduleError,
  ContentTranslationVersionConflict,
  ContentVersionConflict,
} from "../errors";
import { createContentModel } from "./model";
import { buildContentPublicRoutes } from "./public-routes";
import { buildContentRoutes } from "./routes";

/**
 * The document says one thing; the runtime does another.
 *
 * Every generated route declares its responses in OpenAPI, and a generated
 * client is built from exactly that. These tests serve the document the app
 * really publishes and check the body the handler really produced against it -
 * so a `409` that answers with prose where the document promises a
 * discriminated union fails here rather than in somebody's generated client.
 *
 * Two halves, and both matter:
 *
 * 1. **the status is declared** - a runtime `409` on a route whose document
 *    lists only `200` and `404` is a contract break even when the body is fine;
 * 2. **the body validates** - against the emitted JSON Schema rather than
 *    against the Zod object it came from. The two are not interchangeable:
 *    `z.date()` renders as `{ type: "string", format: "date-time" }`, which is
 *    exactly what `c.json(row)` sends and exactly what the Zod object rejects.
 */

vi.mock("../../api/lib/check-staff-permission", () => ({
  assertStaffPermission: async () => await Promise.resolve(),
}));

const posts = createContentModel(testEditorialPostContentType);
const localized = createContentModel(testLocalizedPageContentType);
const PLUGIN_ID = "@vitnode/example";

const adminUser = {
  avatarColor: "000000",
  birthday: null,
  createdAt: new Date(),
  email: "test@test.com",
  emailVerified: true,
  id: 1,
  language: "en",
  name: "Test",
  nameCode: "test",
  newsletter: false,
  roleId: 1,
};

const row = {
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  excerpt: null,
  id: 7,
  publishedAt: null,
  slug: "hello-world",
  status: "draft" as const,
  title: "Hello world",
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  version: 4,
  views: 0,
};

const revision = {
  actorName: null,
  actorRoleColor: null,
  actorType: "staff" as const,
  actorUserId: null,
  changedFields: ["title"],
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  id: 3,
  operation: "update" as const,
  restoredFromRevisionId: null,
  version: 4,
};

const outcome = (overrides: Record<string, unknown> = {}) => ({
  changed: true,
  changedFields: ["title"],
  operation: "update" as const,
  previousSlug: null,
  restoredFromRevisionId: null,
  revisionId: 3,
  row,
  version: 5,
  ...overrides,
});

const declaredStatuses = (route: RouteConfig): number[] =>
  Object.keys(route.responses).map(Number);

interface Suite {
  app: OpenAPIHono;
  /** The served OpenAPI document, which is what a generated client is built from. */
  document: JsonSchemaLike;
  routeOf: (method: string, path: string) => RouteConfig;
}

/**
 * The response schema the **document** publishes for one status.
 *
 * Not the Zod object the route was built from: `z.date()` renders as
 * `{ type: "string", format: "date-time" }`, which is what the handler really
 * sends, while the Zod object rejects that string outright. Reading the emitted
 * document is the only way to check the contract a client actually consumes.
 */
const documentedSchema = (
  suite: Suite,
  route: RouteConfig,
  status: number,
): JsonSchemaLike | undefined => {
  const paths = suite.document.paths as Record<
    string,
    Record<string, { responses?: Record<string, JsonSchemaLike> }>
  >;
  const operation = paths?.[route.path]?.[route.method.toLowerCase()];
  const response = operation?.responses?.[String(status)];
  const content = response?.content as
    Record<string, { schema?: JsonSchemaLike }> | undefined;

  return content?.["application/json"]?.schema;
};

const mount = (
  built: { handler: unknown; route: RouteConfig }[],
  events = {
    emit: async () => await Promise.resolve({ delivered: 0, failures: [] }),
  },
): Suite => {
  const app = new OpenAPIHono();
  const context: MiddlewareHandler = async (c, next) => {
    c.set("admin", { user: adminUser });
    c.set("events", events as never);
    c.set("log", { error: async () => await Promise.resolve() } as never);
    await next();
  };
  app.use("*", context);
  for (const { handler, route } of built) {
    app.openapi(route, handler as never);
  }

  return {
    app,
    document: app.getOpenAPIDocument({
      info: { title: "Content Engine", version: "1" },
      openapi: "3.0.0",
    }) as unknown as JsonSchemaLike,
    routeOf: (method, path) => {
      const found = built.find(
        entry =>
          entry.route.method.toUpperCase() === method.toUpperCase() &&
          entry.route.path === path,
      );
      if (!found) throw new Error(`No route for ${method} ${path}.`);

      return found.route;
    },
  };
};

/**
 * Drives one request and holds the schema its declared status published.
 *
 * The assertion is deliberately in one helper: "the status is in the document
 * and the body parses against it" is the whole contract, and stating it
 * twenty-odd times by hand is twenty-odd chances to state it slightly
 * differently.
 */
const expectParity = async (
  suite: Suite,
  {
    body,
    expected,
    method,
    path,
    template,
  }: {
    body?: unknown;
    expected: number;
    method: string;
    path: string;
    /** The OpenAPI path, when it differs from the concrete one. */
    template: string;
  },
): Promise<unknown> => {
  const res = await suite.app.request(path, {
    method,
    ...(body === undefined
      ? {}
      : {
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json" },
        }),
  });

  expect([`${method} ${path}`, res.status]).toEqual([
    `${method} ${path}`,
    expected,
  ]);

  const route = suite.routeOf(method, template);
  expect([
    `${method} ${template}`,
    declaredStatuses(route).includes(expected),
  ]).toEqual([`${method} ${template}`, true]);

  const schema = documentedSchema(suite, route, expected);
  if (!schema) return undefined;

  const payload: unknown = await res.json();

  // The failure message has to name the route, or a red suite says only "one
  // of the thirty contracts is wrong".
  expect([
    `${method} ${template} -> ${expected}`,
    validateAgainstJsonSchema(payload, schema, suite.document),
  ]).toEqual([`${method} ${template} -> ${expected}`, []]);

  return payload;
};

const adminService = () => ({
  advanced: vi.fn(),
  advancedFields: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
  findById: vi.fn().mockResolvedValue(row),
  findDetail: vi.fn(),
  findRowById: vi.fn().mockResolvedValue({ ...row, labels: {} }),
  findMany: vi.fn().mockResolvedValue({
    edges: [{ ...row, labels: {} }],
    pageInfo: {
      count: 1,
      // Opaque, as `withPagination` mints them: the ordered tuple, base64url'd.
      endCursor: "eyJjb2x1bW4iOiJ2ZXJzaW9uIiwiaWQiOjcsInZhbHVlIjo0fQ",
      hasNextPage: false,
      hasPreviousPage: false,
      startCursor: "eyJjb2x1bW4iOiJ2ZXJzaW9uIiwiaWQiOjcsInZhbHVlIjo0fQ",
      totalCount: 1,
    },
  }),
  options: vi.fn().mockResolvedValue([]),
  relations: {},
  repeatable: {},
  update: vi.fn(),
});

const editorialStub = () => ({
  create: vi.fn().mockResolvedValue(outcome({ operation: "create" })),
  delete: vi.fn().mockResolvedValue(outcome({ operation: "delete" })),
  publish: vi.fn().mockResolvedValue(outcome({ operation: "publish" })),
  relations: {},
  repeatable: {},
  restore: vi.fn().mockResolvedValue(outcome({ operation: "restore" })),
  revisions: {
    findById: vi
      .fn()
      .mockResolvedValue({ ...revision, snapshot: { title: "x" } }),
    latest: vi.fn().mockResolvedValue(revision),
    list: vi.fn().mockResolvedValue({
      edges: [revision],
      pageInfo: { endCursor: 4, hasNextPage: false },
    }),
  },
  schedules: {
    cancel: vi.fn().mockResolvedValue({ action: "publish" }),
    listForItem: vi.fn().mockResolvedValue([]),
    schedule: vi.fn().mockResolvedValue({
      generation: 1,
      id: 55,
      scheduledFor: new Date("2030-01-01T00:00:00.000Z"),
    }),
  },
  unpublish: vi.fn().mockResolvedValue(outcome({ operation: "unpublish" })),
  update: vi.fn().mockResolvedValue(outcome()),
});

let editorial: ReturnType<typeof editorialStub>;
let service: ReturnType<typeof adminService>;

const editorialSuite = (): Suite => {
  service = adminService();
  editorial = editorialStub();
  vi.spyOn(posts, "service").mockReturnValue(service as never);
  vi.spyOn(
    posts as unknown as { editorialService: unknown },
    "editorialService",
    "get",
  ).mockReturnValue(() => editorial);

  return mount(buildContentRoutes(posts, { pluginId: PLUGIN_ID }));
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("admin routes match their OpenAPI document", () => {
  it("publishes nothing about pagination's own column", () => {
    // `__cursorValue` is projected by every list query so a cursor can be
    // minted from the same statement as the row. It is implementation, not
    // contract: it is stripped before the handler sees a row, so it must not
    // appear anywhere a generated client would find it.
    expect(JSON.stringify(editorialSuite().document)).not.toContain(
      "__cursorValue",
    );
  });

  it("lists", async () => {
    await expectParity(editorialSuite(), {
      expected: 200,
      method: "GET",
      path: "/",
      template: "/",
    });
  });

  it("reads one record", async () => {
    await expectParity(editorialSuite(), {
      expected: 200,
      method: "GET",
      path: "/7",
      template: "/{id}",
    });
  });

  it("answers 404 for a record that is not there", async () => {
    const suite = editorialSuite();
    service.findRowById.mockResolvedValue(null);

    await expectParity(suite, {
      expected: 404,
      method: "GET",
      path: "/7",
      template: "/{id}",
    });
  });

  it("creates", async () => {
    await expectParity(editorialSuite(), {
      body: { title: "Hello world" },
      expected: 201,
      method: "POST",
      path: "/",
      template: "/",
    });
  });

  it("rejects an invalid create with the declared 400", async () => {
    await expectParity(editorialSuite(), {
      body: { title: "no" },
      expected: 400,
      method: "POST",
      path: "/",
      template: "/",
    });
  });

  it("updates", async () => {
    await expectParity(editorialSuite(), {
      body: { expectedVersion: 4, values: { title: "Hello again" } },
      expected: 200,
      method: "PUT",
      path: "/7",
      template: "/{id}",
    });
  });

  it("answers a stale update with the documented 409 union", async () => {
    const suite = editorialSuite();
    editorial.update.mockRejectedValue(
      new ContentVersionConflict({
        contentTypeId: testEditorialPostContentType.id,
        currentVersion: 6,
        expectedVersion: 4,
        itemId: 7,
      }),
    );

    const body = await expectParity(suite, {
      body: { expectedVersion: 4, values: { title: "Hello again" } },
      expected: 409,
      method: "PUT",
      path: "/7",
      template: "/{id}",
    });

    // The discriminant, spelled out: a client branches on it, so a schema that
    // merely admits a string would be a weaker contract than it looks.
    expect(body).toMatchObject({ code: "CONTENT_VERSION_CONFLICT" });
  });

  it("answers a unique clash with the same 409 union", async () => {
    const suite = editorialSuite();
    editorial.update.mockRejectedValue(
      Object.assign(new Error("duplicate"), { code: "23505" }),
    );

    const body = await expectParity(suite, {
      body: { expectedVersion: 4, values: { title: "Hello again" } },
      expected: 409,
      method: "PUT",
      path: "/7",
      template: "/{id}",
    });

    expect(body).toMatchObject({ code: "CONTENT_UNIQUE_CONFLICT" });
  });

  it("publishes", async () => {
    await expectParity(editorialSuite(), {
      expected: 200,
      method: "POST",
      path: "/7/publish",
      template: "/{id}/publish",
    });
  });

  it("unpublishes", async () => {
    await expectParity(editorialSuite(), {
      expected: 200,
      method: "POST",
      path: "/7/unpublish",
      template: "/{id}/unpublish",
    });
  });

  it("deletes", async () => {
    await expectParity(editorialSuite(), {
      body: { expectedVersion: 4 },
      expected: 200,
      method: "DELETE",
      path: "/7",
      template: "/{id}",
    });
  });

  it("lists revisions", async () => {
    await expectParity(editorialSuite(), {
      expected: 200,
      method: "GET",
      path: "/7/revisions",
      template: "/{id}/revisions",
    });
  });

  it("reads one revision with its snapshot", async () => {
    await expectParity(editorialSuite(), {
      expected: 200,
      method: "GET",
      path: "/7/revisions/3",
      template: "/{id}/revisions/{revisionId}",
    });
  });

  it("restores", async () => {
    await expectParity(editorialSuite(), {
      body: { expectedVersion: 4 },
      expected: 200,
      method: "POST",
      path: "/7/revisions/3/restore",
      template: "/{id}/revisions/{revisionId}/restore",
    });
  });

  it("answers an unrestorable revision with the documented 422", async () => {
    const suite = editorialSuite();
    editorial.restore.mockRejectedValue(
      new ContentRevisionNotRestorable({
        contentTypeId: testEditorialPostContentType.id,
        fields: ["title"],
        revisionId: 3,
      }),
    );

    const body = await expectParity(suite, {
      body: { expectedVersion: 4 },
      expected: 422,
      method: "POST",
      path: "/7/revisions/3/restore",
      template: "/{id}/revisions/{revisionId}/restore",
    });

    expect(body).toMatchObject({
      code: "CONTENT_REVISION_NOT_RESTORABLE",
      fields: ["title"],
    });
  });

  it("lists schedules", async () => {
    await expectParity(editorialSuite(), {
      expected: 200,
      method: "GET",
      path: "/7/schedules",
      template: "/{id}/schedules",
    });
  });

  it("books a schedule", async () => {
    await expectParity(editorialSuite(), {
      body: {
        action: "publish",
        scheduledFor: new Date(Date.now() + 86_400_000).toISOString(),
      },
      expected: 200,
      method: "POST",
      path: "/7/schedule",
      template: "/{id}/schedule",
    });
  });

  it("answers a refused schedule with the documented 400 body", async () => {
    const suite = editorialSuite();
    editorial.schedules.schedule.mockRejectedValue(
      new ContentScheduleError("That time has already passed.", {
        code: "CONTENT_SCHEDULE_IN_PAST",
        contentTypeId: testEditorialPostContentType.id,
      }),
    );

    const body = await expectParity(suite, {
      body: {
        action: "publish",
        scheduledFor: new Date(Date.now() + 86_400_000).toISOString(),
      },
      expected: 400,
      method: "POST",
      path: "/7/schedule",
      template: "/{id}/schedule",
    });

    expect(body).toMatchObject({ code: "CONTENT_SCHEDULE_IN_PAST" });
  });

  it("cancels a schedule", async () => {
    await expectParity(editorialSuite(), {
      expected: 200,
      method: "POST",
      path: "/7/schedule/5/cancel",
      template: "/{id}/schedule/{scheduleId}/cancel",
    });
  });

  it("mints a preview link", async () => {
    vi.stubEnv("CONTENT_PREVIEW_SECRET", "a".repeat(48));
    const suite = editorialSuite();

    await expectParity(suite, {
      expected: 200,
      method: "POST",
      path: "/7/preview",
      template: "/{id}/preview",
    });
    vi.unstubAllEnvs();
  });
});

describe("translation routes match their OpenAPI document", () => {
  const translationRow = {
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    itemId: 7,
    languageId: 1,
    locale: "en",
    publishedAt: null,
    status: "draft" as const,
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    values: { body: "Body", slug: "hello", title: "Hello" },
    version: 2,
  };

  const translationOutcome = (overrides: Record<string, unknown> = {}) => ({
    changed: true,
    changedFields: ["title"],
    languageId: 1,
    locale: "en",
    operation: "update" as const,
    previousSlug: null,
    restoredFromRevisionId: null,
    revisionId: 9,
    row: translationRow,
    version: 3,
    ...overrides,
  });

  let translations: Record<string, ReturnType<typeof vi.fn>>;
  let translationEditorial: Record<string, unknown>;

  const suite = (): Suite => {
    translations = {
      exists: vi.fn().mockResolvedValue(true),
      findByLanguageId: vi.fn().mockResolvedValue(translationRow),
      findByLocale: vi.fn().mockResolvedValue(translationRow),
      findManyForItem: vi.fn().mockResolvedValue([
        {
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          itemId: 7,
          languageId: 1,
          locale: "en",
          publishedAt: null,
          status: "draft",
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          version: 2,
        },
      ]),
      findManyRowsForItem: vi.fn().mockResolvedValue([translationRow]),
      resolveDefaultLanguage: vi
        .fn()
        .mockResolvedValue({ id: 1, locale: "en" }),
      resolveLanguage: vi.fn().mockResolvedValue({ id: 1, locale: "en" }),
    };
    translationEditorial = {
      create: vi
        .fn()
        .mockResolvedValue(translationOutcome({ operation: "create" })),
      delete: vi
        .fn()
        .mockResolvedValue(translationOutcome({ operation: "delete" })),
      publish: vi
        .fn()
        .mockResolvedValue(translationOutcome({ operation: "publish" })),
      restore: vi
        .fn()
        .mockResolvedValue(translationOutcome({ operation: "restore" })),
      findRevision: vi
        .fn()
        .mockResolvedValue({ ...revision, snapshot: { title: "x" } }),
      listRevisions: vi.fn().mockResolvedValue({
        edges: [revision],
        pageInfo: { endCursor: 2, hasNextPage: false },
      }),
      unpublish: vi
        .fn()
        .mockResolvedValue(translationOutcome({ operation: "unpublish" })),
      update: vi.fn().mockResolvedValue(translationOutcome()),
    };

    vi.spyOn(
      localized as unknown as { translationService: unknown },
      "translationService",
      "get",
    ).mockReturnValue(() => translations);
    vi.spyOn(
      localized as unknown as { translationEditorialService: unknown },
      "translationEditorialService",
      "get",
    ).mockReturnValue(() => translationEditorial);
    vi.spyOn(localized, "service").mockReturnValue(adminService() as never);

    return mount(buildContentRoutes(localized, { pluginId: PLUGIN_ID }));
  };

  it("lists the locales a record exists in", async () => {
    await expectParity(suite(), {
      expected: 200,
      method: "GET",
      path: "/7/translations",
      template: "/{id}/translations",
    });
  });

  it("reads one translation", async () => {
    await expectParity(suite(), {
      expected: 200,
      method: "GET",
      path: "/7/translations/en",
      template: "/{id}/translations/{locale}",
    });
  });

  it("creates a translation", async () => {
    await expectParity(suite(), {
      body: { values: { body: "Cześć", slug: "czesc", title: "Cześć" } },
      expected: 201,
      method: "POST",
      path: "/7/translations/pl",
      template: "/{id}/translations/{locale}",
    });
  });

  it("updates a translation", async () => {
    await expectParity(suite(), {
      body: { expectedVersion: 2, values: { title: "Hello again" } },
      expected: 200,
      method: "PUT",
      path: "/7/translations/en",
      template: "/{id}/translations/{locale}",
    });
  });

  it("answers a stale translation update with the translation 409 union", async () => {
    const built = suite();
    (translationEditorial.update as ReturnType<typeof vi.fn>).mockRejectedValue(
      new ContentTranslationVersionConflict({
        contentTypeId: testLocalizedPageContentType.id,
        currentVersion: 5,
        expectedVersion: 2,
        itemId: 7,
        locale: "en",
      }),
    );

    const body = await expectParity(built, {
      body: { expectedVersion: 2, values: { title: "Hello again" } },
      expected: 409,
      method: "PUT",
      path: "/7/translations/en",
      template: "/{id}/translations/{locale}",
    });

    expect(body).toMatchObject({
      code: "CONTENT_TRANSLATION_VERSION_CONFLICT",
      locale: "en",
    });
  });

  it("answers a default-translation delete with the documented 409", async () => {
    const built = suite();
    (translationEditorial.delete as ReturnType<typeof vi.fn>).mockRejectedValue(
      new ContentDefaultTranslationRequired({
        contentTypeId: testLocalizedPageContentType.id,
        itemId: 7,
        locale: "en",
      }),
    );

    const body = await expectParity(built, {
      body: { expectedVersion: 2 },
      expected: 409,
      method: "DELETE",
      path: "/7/translations/en",
      template: "/{id}/translations/{locale}",
    });

    expect(body).toMatchObject({
      code: "CONTENT_DEFAULT_TRANSLATION_REQUIRED",
    });
  });

  it("lists one locale's revisions", async () => {
    await expectParity(suite(), {
      expected: 200,
      method: "GET",
      path: "/7/translations/en/revisions",
      template: "/{id}/translations/{locale}/revisions",
    });
  });
});

describe("public routes match their OpenAPI document", () => {
  const publicRow = {
    excerpt: null,
    publishedAt: new Date("2026-01-01T00:00:00.000Z"),
    slug: "hello-world",
    title: "Hello world",
  };

  const suite = (
    findBySlug: unknown = publicRow,
    findById: unknown = publicRow,
  ): Suite => {
    vi.spyOn(
      posts as unknown as { publicService: unknown },
      "publicService",
      "get",
    ).mockReturnValue(() => ({
      findById: async () => await Promise.resolve(findById),
      findBySlug: async () => await Promise.resolve(findBySlug),
      findMany: async () =>
        await Promise.resolve({
          edges: [publicRow],
          pageInfo: {
            count: 1,
            // Opaque, as `withPagination` mints them.
            endCursor: "eyJjb2x1bW4iOiJwdWJsaXNoZWRBdCIsImlkIjo3fQ",
            hasNextPage: false,
            hasPreviousPage: false,
            startCursor: "eyJjb2x1bW4iOiJwdWJsaXNoZWRBdCIsImlkIjo3fQ",
            totalCount: 1,
          },
        }),
    }));

    return mount(buildContentPublicRoutes(posts, { pluginId: PLUGIN_ID }));
  };

  it("publishes nothing about pagination's own column", () => {
    expect(JSON.stringify(suite().document)).not.toContain("__cursorValue");
  });

  it("lists", async () => {
    await expectParity(suite(), {
      expected: 200,
      method: "GET",
      path: "/",
      template: "/",
    });
  });

  it("reads by slug", async () => {
    await expectParity(suite(), {
      expected: 200,
      method: "GET",
      path: "/hello-world",
      template: "/{slug}",
    });
  });

  it("answers 404 for an unpublished slug", async () => {
    await expectParity(suite(null), {
      expected: 404,
      method: "GET",
      path: "/hello-world",
      template: "/{slug}",
    });
  });
});

/**
 * The Stage 8 routes, held to the same contract as everything above.
 *
 * They are the ones with the most to get wrong: a `Date` that has to leave as an
 * ISO string, a discriminated union a frontend branches on to decide between
 * rendering a page and issuing a 308, and a third arm on the editorial `409`. A
 * generated client is built from the document, so each of those is a promise the
 * handler has to keep rather than a schema that merely looks right.
 */
describe("delivery routes match their OpenAPI document", () => {
  const delivered = createContentModel(testDeliveredPostContentType);

  const metadata = {
    alternates: [],
    canonicalPath: "/delivered-posts/hello-world",
    hreflang: { languages: {} },
    isFallback: false,
    itemId: 42,
    locale: null,
    openGraph: { description: "Prose", title: "Hello world" },
    requestedLocale: null,
    robots: { follow: true, index: true },
    seo: { description: "Prose", title: "Hello world" },
  };

  const deliveryStub = () => ({
    alternates: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(metadata),
    history: vi.fn().mockResolvedValue([
      {
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        itemId: 42,
        languageId: null,
        path: "/delivered-posts/hello-world",
        retiredAt: null,
        slug: "hello-world",
      },
      {
        createdAt: new Date("2025-12-01T00:00:00.000Z"),
        itemId: 42,
        languageId: null,
        path: "/delivered-posts/old-address",
        retiredAt: new Date("2026-01-01T00:00:00.000Z"),
        slug: "old-address",
      },
    ]),
    resolvePath: vi.fn(),
    resolveSlug: vi.fn().mockResolvedValue({ ...metadata, type: "content" }),
    sitemap: vi.fn().mockResolvedValue({
      entries: [
        {
          changeFrequency: "weekly",
          itemId: 42,
          // A `Date` in the service, an ISO string on the wire: exactly the pair
          // this suite exists to keep honest.
          lastModified: new Date("2026-01-02T03:04:05.000Z"),
          locale: null,
          path: "/delivered-posts/hello-world",
          priority: 0.7,
        },
      ],
      nextCursor: null,
    }),
  });

  let delivery: ReturnType<typeof deliveryStub>;

  /** The public delivery routes: resolve, item and sitemap. */
  const publicSuite = (): Suite => {
    delivery = deliveryStub();
    vi.spyOn(delivered, "deliveryService", "get").mockReturnValue(
      () => delivery,
    );
    vi.spyOn(
      delivered as unknown as { publicService: unknown },
      "publicService",
      "get",
    ).mockReturnValue(() => ({
      findById: vi.fn(),
      findBySlug: vi.fn(),
      findMany: vi.fn(),
    }));

    return mount(buildContentPublicRoutes(delivered, { pluginId: PLUGIN_ID }));
  };

  /** The AdminCP delivery panel's route, plus the editorial routes around it. */
  const adminSuite = (
    editorialOverrides: Record<string, unknown> = {},
  ): Suite => {
    delivery = deliveryStub();
    vi.spyOn(delivered, "deliveryService", "get").mockReturnValue(
      () => delivery,
    );
    vi.spyOn(delivered, "service").mockReturnValue(adminService() as never);
    const editorial = { ...editorialStub(), ...editorialOverrides };
    vi.spyOn(
      delivered as unknown as { editorialService: unknown },
      "editorialService",
      "get",
    ).mockReturnValue(() => editorial);

    return mount(buildContentRoutes(delivered, { pluginId: PLUGIN_ID }));
  };

  it("publishes nothing about pagination's own column", () => {
    expect(JSON.stringify(publicSuite().document)).not.toContain(
      "__cursorValue",
    );
    expect(JSON.stringify(adminSuite().document)).not.toContain(
      "__cursorValue",
    );
  });

  it("resolves a slug into the content arm", async () => {
    const body = await expectParity(publicSuite(), {
      expected: 200,
      method: "GET",
      path: "/delivery/resolve/hello-world",
      template: "/delivery/resolve/{slug}",
    });

    expect(body).toMatchObject({ type: "content" });
  });

  it("resolves a retired slug into the redirect arm", async () => {
    const suite = publicSuite();
    delivery.resolveSlug.mockResolvedValue({
      location: "/delivered-posts/hello-world",
      status: 308,
      type: "redirect",
    });

    const body = await expectParity(suite, {
      expected: 200,
      method: "GET",
      path: "/delivery/resolve/old-address",
      template: "/delivery/resolve/{slug}",
    });

    // The discriminant a frontend branches on to issue a 308 rather than render.
    expect(body).toMatchObject({ status: 308, type: "redirect" });
  });

  it("answers an unknown slug with the not_found arm, still a 200", async () => {
    const suite = publicSuite();
    delivery.resolveSlug.mockResolvedValue({ type: "not_found" });

    const body = await expectParity(suite, {
      expected: 200,
      method: "GET",
      path: "/delivery/resolve/nope",
      template: "/delivery/resolve/{slug}",
    });

    expect(body).toStrictEqual({ type: "not_found" });
  });

  it("reads one record's delivery metadata", async () => {
    await expectParity(publicSuite(), {
      expected: 200,
      method: "GET",
      path: "/delivery/item/42",
      template: "/delivery/item/{id}",
    });
  });

  it("answers 404 for a record with no public version", async () => {
    const suite = publicSuite();
    delivery.findById.mockResolvedValue(null);

    await expectParity(suite, {
      expected: 404,
      method: "GET",
      path: "/delivery/item/42",
      template: "/delivery/item/{id}",
    });
  });

  it("serves a sitemap page whose lastModified is the documented string", async () => {
    const body = await expectParity(publicSuite(), {
      expected: 200,
      method: "GET",
      path: "/delivery/sitemap",
      template: "/delivery/sitemap",
    });

    expect(body).toMatchObject({
      entries: [{ lastModified: "2026-01-02T03:04:05.000Z" }],
      nextCursor: null,
    });
  });

  it("serves the AdminCP delivery panel, dates and all", async () => {
    const body = await expectParity(adminSuite(), {
      expected: 200,
      method: "GET",
      path: "/7/delivery",
      template: "/{id}/delivery",
    });

    // The storage columns behind a history row are not part of the contract, and
    // the schema is closed, so the document validating is what proves it.
    expect(body).toMatchObject({
      canonicalPath: "/delivered-posts/hello-world",
      history: [{ slug: "hello-world" }, { slug: "old-address" }],
    });
    expect(body).not.toHaveProperty("history.0.languageId");
  });

  it("answers a reserved address with the documented 409 arm", async () => {
    // The write fails the way a taken historical address fails: the slug is free
    // on the live table and owned by another record's URL history.
    const suite = adminSuite({
      update: vi.fn().mockRejectedValue(
        new ContentDeliverySlugReserved({
          contentTypeId: testDeliveredPostContentType.id,
          locale: null,
          slug: "hello-world",
        }),
      ),
    });

    const body = await expectParity(suite, {
      body: { expectedVersion: 4, values: { title: "Hello again" } },
      expected: 409,
      method: "PUT",
      path: "/7",
      template: "/{id}",
    });

    // The third arm, and the reason it is a union rather than a replacement: a
    // client generated before Stage 8 still parses the two it knows.
    expect(body).toMatchObject({
      code: "CONTENT_DELIVERY_SLUG_RESERVED",
      slug: "hello-world",
    });
  });
});
