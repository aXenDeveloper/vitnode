// @vitest-environment node
import type { MiddlewareHandler } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PermissionsStaffArgs } from "@/api/lib/permission-staff";

import { createTestCache } from "@/tests/cache";
import {
  testLocalizedArticleContentType,
  testLocalizedGuideContentType,
} from "@/tests/content-fixtures";
import {
  grantStaffPermissions,
  ROOT_STAFF_PERMISSIONS,
} from "@/tests/staff-permissions";

import { CONTENT_PERMISSIONS } from "../const";
import {
  ContentRevisionNotRestorable,
  ContentTranslationVersionConflict,
} from "../errors";
import { contentPermissionEntries } from "../registry";
import { createContentModel } from "./model";
import { buildContentTranslationRoutes } from "./translation-routes";

const emitted = vi.fn(() => ({ failures: [], listeners: 0 }));

const guide = createContentModel(testLocalizedGuideContentType);
const plain = createContentModel(testLocalizedArticleContentType);
const PLUGIN_ID = "@vitnode/example";

const guidePermission = (permission: string): PermissionsStaffArgs => ({
  module: "localized_guide",
  permission,
  plugin: PLUGIN_ID,
});

const everyGuidePermissionExcept = (
  permission: string,
): PermissionsStaffArgs[] =>
  Object.values(CONTENT_PERMISSIONS)
    .filter(entry => entry !== permission)
    .map(guidePermission);

const adminUser = {
  avatarColor: "000000",
  headline: null,
  phone: null,
  showRealName: false,
  firstName: null,
  lastName: null,
  avatarUrl: null,
  birthday: null,
  coverUrl: null,
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

const row = (overrides: Record<string, unknown> = {}) => ({
  createdAt: new Date("2026-01-01T00:00:00Z"),
  itemId: 7,
  languageId: 2,
  locale: "pl",
  publishedAt: null,
  status: "draft",
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  values: { body: null, slug: "witaj", summary: null, title: "Witaj" },
  version: 1,
  ...overrides,
});

const outcome = (overrides: Record<string, unknown> = {}) => ({
  changed: true,
  changedFields: [],
  languageId: 2,
  locale: "pl",
  operation: "publish",
  previousSlug: null,
  restoredFromRevisionId: null,
  revisionId: 101,
  row: row(),
  version: 2,
  ...overrides,
});

const harness = async (
  permissions:
    | PermissionsStaffArgs[]
    | typeof ROOT_STAFF_PERMISSIONS = ROOT_STAFF_PERMISSIONS,
) => {
  const editorial = {
    create: vi.fn(),
    delete: vi.fn(),
    findRevision: vi.fn(),
    listRevisions: vi.fn(),
    publish: vi.fn(),
    restore: vi.fn(),
    unpublish: vi.fn(),
    update: vi.fn(),
  };

  const cache = createTestCache();
  await grantStaffPermissions(cache, { permissions, userId: adminUser.id });
  vi.spyOn(guide, "translationEditorialService", "get").mockReturnValue(
    () => editorial,
  );
  vi.spyOn(guide, "translationService", "get").mockReturnValue(
    () =>
      ({
        // Only the metadata read is reachable from these routes; everything else
        // goes through the editorial layer above.
        findManyForItem: vi.fn(() => []),
      }) as never,
  );

  const app = new OpenAPIHono();
  const context: MiddlewareHandler = async (c, next) => {
    c.set("admin", { user: adminUser });
    c.set("cache", cache);
    c.set("events", { emit: emitted } as never);
    await next();
  };
  app.use("*", context);

  for (const { handler, route } of buildContentTranslationRoutes(guide, {
    pluginId: PLUGIN_ID,
  })) {
    app.openapi(route, handler);
  }

  return { app, editorial };
};

const post = async (
  app: OpenAPIHono,
  path: string,
  body: unknown = { expectedVersion: 1 },
) =>
  await app.request(path, {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "post",
  });

beforeEach(() => {
  vi.restoreAllMocks();
  emitted.mockClear();
});

describe("route registration", () => {
  it("adds the lifecycle and history routes for a localized editorial type", () => {
    const paths = buildContentTranslationRoutes(guide, {
      pluginId: PLUGIN_ID,
    }).map(entry => `${entry.route.method.toUpperCase()} ${entry.route.path}`);

    expect(paths).toEqual([
      "GET /{id}/translations",
      "GET /{id}/translations/{locale}",
      "POST /{id}/translations/{locale}",
      "PUT /{id}/translations/{locale}",
      "DELETE /{id}/translations/{locale}",
      "POST /{id}/translations/{locale}/publish",
      "POST /{id}/translations/{locale}/unpublish",
      "GET /{id}/translations/{locale}/revisions",
      "GET /{id}/translations/{locale}/revisions/{revisionId}",
      "POST /{id}/translations/{locale}/revisions/{revisionId}/restore",
    ]);
  });

  it("adds none of them without publication or editorial", () => {
    const paths = buildContentTranslationRoutes(plain, {
      pluginId: PLUGIN_ID,
    }).map(entry => entry.route.path);

    // The Stage 5A surface exactly, and nothing that would gate a state the
    // content type does not have.
    expect(paths).toEqual([
      "/{id}/translations",
      "/{id}/translations/{locale}",
      "/{id}/translations/{locale}",
      "/{id}/translations/{locale}",
      "/{id}/translations/{locale}",
    ]);
  });
});

describe("publish and unpublish", () => {
  it("publishes one locale and announces it once", async () => {
    const { app, editorial } = await harness();
    editorial.publish.mockResolvedValue(
      outcome({ row: row({ status: "published", version: 2 }) }),
    );

    const response = await post(app, "/7/translations/pl/publish");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ changed: true });
    expect(editorial.publish).toHaveBeenCalledWith(7, "pl", {
      actor: { type: "staff", userId: 1 },
      expectedVersion: 1,
    });
    expect(emitted).toHaveBeenCalledTimes(1);
  });

  it("announces nothing for an idempotent publish", async () => {
    const { app, editorial } = await harness();
    editorial.publish.mockResolvedValue(
      outcome({ changed: false, revisionId: null }),
    );

    const response = await post(app, "/7/translations/pl/publish");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ changed: false });
    expect(emitted).not.toHaveBeenCalled();
  });

  it("unpublishes with `can_publish` alone", async () => {
    const { app, editorial } = await harness([guidePermission("can_publish")]);
    editorial.unpublish.mockResolvedValue(outcome({ operation: "unpublish" }));

    expect((await post(app, "/7/translations/pl/unpublish")).status).toBe(200);
  });

  it("refuses to unpublish without `can_publish`", async () => {
    const { app, editorial } = await harness(
      everyGuidePermissionExcept("can_publish"),
    );

    expect((await post(app, "/7/translations/pl/unpublish")).status).toBe(403);
    expect(editorial.unpublish).not.toHaveBeenCalled();
  });

  it("answers 404 when the locale has no translation", async () => {
    const { app, editorial } = await harness();
    editorial.publish.mockResolvedValue(null);

    expect((await post(app, "/7/translations/pl/publish")).status).toBe(404);
  });

  it("answers a structured 409 for a stale version", async () => {
    const { app, editorial } = await harness();
    editorial.publish.mockRejectedValue(
      new ContentTranslationVersionConflict({
        contentTypeId: testLocalizedGuideContentType.id,
        currentVersion: 4,
        expectedVersion: 1,
        itemId: 7,
        locale: "pl",
      }),
    );

    const response = await post(app, "/7/translations/pl/publish");

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      code: "CONTENT_TRANSLATION_VERSION_CONFLICT",
      contentTypeId: "test.localized-guide",
      currentVersion: 4,
      expectedVersion: 1,
      itemId: 7,
      // The locale is in every arm, which is what lets a tab strip point at the
      // right tab rather than at the record.
      locale: "pl",
    });
  });
});

describe("history", () => {
  it("lists one locale's revisions", async () => {
    const { app, editorial } = await harness();
    editorial.listRevisions.mockResolvedValue({
      edges: [],
      pageInfo: { endCursor: null, hasNextPage: false },
    });

    const response = await app.request("/7/translations/pl/revisions");

    expect(response.status).toBe(200);
    expect(editorial.listRevisions).toHaveBeenCalledWith(7, "pl", {
      cursor: undefined,
      limit: undefined,
    });
  });

  it("passes the cursor through as a version", async () => {
    const { app, editorial } = await harness();
    editorial.listRevisions.mockResolvedValue({
      edges: [],
      pageInfo: { endCursor: null, hasNextPage: false },
    });

    await app.request("/7/translations/pl/revisions?cursor=5&first=10");

    expect(editorial.listRevisions).toHaveBeenCalledWith(7, "pl", {
      cursor: 5,
      limit: 10,
    });
  });

  it("reads with `can_view` alone", async () => {
    const { app, editorial } = await harness([guidePermission("can_view")]);
    editorial.listRevisions.mockResolvedValue({
      edges: [],
      pageInfo: { endCursor: null, hasNextPage: false },
    });

    expect((await app.request("/7/translations/pl/revisions")).status).toBe(
      200,
    );
  });

  it("refuses to read without `can_view`, even with `can_restore`", async () => {
    const { app, editorial } = await harness(
      everyGuidePermissionExcept("can_view"),
    );

    expect((await app.request("/7/translations/pl/revisions")).status).toBe(
      403,
    );
    expect(editorial.listRevisions).not.toHaveBeenCalled();
  });

  it("answers 404 for a revision outside this locale", async () => {
    const { app, editorial } = await harness();
    editorial.findRevision.mockResolvedValue(null);

    expect((await app.request("/7/translations/pl/revisions/42")).status).toBe(
      404,
    );
  });
});

describe("restore", () => {
  it("restores with `can_restore` alone", async () => {
    const { app, editorial } = await harness([guidePermission("can_restore")]);
    editorial.restore.mockResolvedValue(outcome({ operation: "restore" }));

    expect(
      (await post(app, "/7/translations/pl/revisions/42/restore")).status,
    ).toBe(200);
  });

  it("refuses to restore without `can_restore`", async () => {
    const { app, editorial } = await harness(
      everyGuidePermissionExcept("can_restore"),
    );

    expect(
      (await post(app, "/7/translations/pl/revisions/42/restore")).status,
    ).toBe(403);
    expect(editorial.restore).not.toHaveBeenCalled();
  });

  it("requires an expectedVersion", async () => {
    const { app } = await harness();

    expect(
      (await post(app, "/7/translations/pl/revisions/42/restore", {})).status,
    ).toBe(400);
  });

  it("answers a structured 422 when the snapshot no longer fits", async () => {
    const { app, editorial } = await harness();
    editorial.restore.mockRejectedValue(
      new ContentRevisionNotRestorable({
        contentTypeId: testLocalizedGuideContentType.id,
        fields: ["title"],
        revisionId: 42,
      }),
    );

    const response = await post(app, "/7/translations/pl/revisions/42/restore");

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      code: "CONTENT_REVISION_NOT_RESTORABLE",
      contentTypeId: "test.localized-guide",
      // Field names only - never a Zod issue tree, which names internal paths.
      fields: ["title"],
      revisionId: 42,
    });
  });

  it("rejects a non-numeric revision identifier", async () => {
    const { app } = await harness();

    expect(
      (await post(app, "/7/translations/pl/revisions/abc/restore")).status,
    ).toBe(400);
  });
});

describe("permissions catalogue", () => {
  it("adds no translation permission for a localized content type", () => {
    const entries = contentPermissionEntries(testLocalizedGuideContentType);

    // Writing a language is editing the record, so `can_edit` is the whole
    // answer and there is nothing localization-specific to grant.
    expect(
      entries.some(
        entry =>
          typeof entry === "object" && entry.permission === "can_translate",
      ),
    ).toBe(false);
    expect(entries).toContainEqual({
      dependsOn: ["can_view"],
      permission: "can_edit",
    });
  });

  it("produces the same catalogue with localization switched off", () => {
    const entries = contentPermissionEntries(testLocalizedGuideContentType);
    const withoutLocalization = contentPermissionEntries({
      ...testLocalizedGuideContentType,
      localization: {
        ...testLocalizedGuideContentType.localization,
        enabled: false,
      },
    });

    expect(withoutLocalization).toEqual(entries);
  });
});
