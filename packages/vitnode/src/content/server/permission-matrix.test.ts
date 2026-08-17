// @vitest-environment node
import type { MiddlewareHandler } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { defineContentType } from "../define";
import { field } from "../fields";
import { createContentModel } from "./model";
import { buildContentRoutes } from "./routes";

/**
 * Every generated route, against the permission it actually demands.
 *
 * The existing route suites check permissions one endpoint at a time, which is
 * fine until somebody adds an endpoint. This one **enumerates** the routes the
 * builder produced and drives each of them, so a new route cannot join the set
 * without appearing in the matrix below - and a route with no
 * `adminStaffPermission` at all cannot join it silently, because it would answer
 * something other than 403 with every permission denied.
 *
 * The permission check itself is stubbed: it reads roles out of the database,
 * and what is under test is which `(module, permission)` each route asks for.
 */

/** Grants for the request currently in flight. `"module:permission"`. */
let granted = new Set<string>();
/** What each request was asked for, in order. */
let asked: { module: string; permission: string; plugin: string }[] = [];

vi.mock("../../api/lib/check-staff-permission", () => ({
  assertStaffPermission: async (
    _c: unknown,
    args: { module: string; permission: string; plugin: string },
  ) => {
    asked.push({
      module: args.module,
      permission: args.permission,
      plugin: args.plugin,
    });
    if (granted.has(`${args.module}:${args.permission}`)) return;

    const { HTTPException } = await import("hono/http-exception");
    throw new HTTPException(403, { message: "Forbidden" });
  },
}));

/**
 * Everything a content type can switch on, at once.
 *
 * A maximal fixture on purpose: the matrix is only as complete as the set of
 * routes the builder was asked to produce, and a fixture missing `scheduling`
 * would quietly drop three endpoints out of the audit.
 */
const kitchenSink = defineContentType({
  id: "test.everything",
  tableName: "test_everything",
  localization: { enabled: true, defaultLocale: "en", fallback: "default" },
  publication: { enabled: true },
  editorial: {
    enabled: true,
    revisions: { retention: 10 },
    preview: { enabled: true, expiresInMinutes: 30 },
    scheduling: { enabled: true },
  },
  fields: {
    title: field.text({ localized: true, required: true, maxLength: 200 }),
    slug: field.slug({ localized: true, source: "title" }),
    featured: field.boolean({ defaultValue: false }),
    // A reference field, so the picker route exists to be audited.
    author: field.user(),
    // A collection, so the advanced write path is exercised through the same
    // `PUT` an ordinary field edit goes through.
    faq: field.repeatable({
      fields: {
        question: field.text({ required: true, maxLength: 200 }),
        answer: field.textarea({ required: true }),
      },
    }),
  },
  publicApi: {
    enabled: true,
    path: "everything",
    // `id` is exposed because delivery resolves alternates by identifier off the
    // public projection, and a localized delivery content type is refused without
    // it.
    fields: ["id", "title", "slug", "featured", "publishedAt"],
    orderableFields: ["publishedAt"],
  },
  // Stage 8, so the delivery route is audited like every other one. `redirects`
  // needs `editorial` and a localized slug, and this fixture has both - which is
  // the whole reason it is the maximal one rather than a second fixture.
  delivery: {
    enabled: true,
    redirects: { enabled: true },
    seo: { titleField: "title" },
    sitemap: { enabled: true },
  },
  admin: {
    list: { columns: ["featured", "status"] },
    form: { fields: ["faq"] },
  },
});

const model = createContentModel(kitchenSink);
const MODULE = kitchenSink.permissionModule;
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

/** Concrete values for the path parameters the generated routes declare. */
const PARAMS: Record<string, string> = {
  field: "author",
  id: "7",
  locale: "en",
  revisionId: "3",
  scheduleId: "5",
};

const concretePath = (template: string): string =>
  template.replace(/\{(\w+)\}/g, (_match, name: string) => {
    const value = PARAMS[name];
    if (value === undefined) {
      throw new Error(`No test value for path parameter "{${name}}".`);
    }

    return value;
  });

/**
 * A body wide enough for every write route the builder produces.
 *
 * Never actually validated in the denial sweep - the permission middleware runs
 * first - but a `PUT` with no body would fail for the wrong reason in the editor
 * sweep, where some of these routes are allowed through.
 */
const BODY = {
  action: "publish" as const,
  expectedVersion: 1,
  scheduledFor: new Date(Date.now() + 86_400_000).toISOString(),
  values: { title: "Hello world" },
};

const routes = buildContentRoutes(model, { pluginId: PLUGIN_ID });

const app = (() => {
  const instance = new OpenAPIHono();
  const context: MiddlewareHandler = async (c, next) => {
    c.set("admin", { user: adminUser });
    c.set("events", {
      emit: async () => await Promise.resolve({ failures: [] }),
    } as never);
    await next();
  };
  instance.use("*", context);
  for (const { handler, route } of routes) instance.openapi(route, handler);

  return instance;
})();

const request = async (method: string, path: string) =>
  await app.request(path, {
    method,
    ...(method === "GET" || method === "DELETE"
      ? method === "DELETE"
        ? {
            body: JSON.stringify(BODY),
            headers: { "Content-Type": "application/json" },
          }
        : {}
      : {
          body: JSON.stringify(BODY),
          headers: { "Content-Type": "application/json" },
        }),
  });

/** `"GET /{id}/revisions"` - stable across runs, so the matrix reads as a list. */
const label = (route: { method: string; path: string }): string =>
  `${route.method.toUpperCase()} ${route.path}`;

beforeEach(() => {
  granted = new Set();
  asked = [];
});

describe("the generated permission matrix", () => {
  it("gates every route on a staff permission", async () => {
    // Nothing granted, so a route with a permission answers 403 and a route
    // without one answers whatever its handler does. The assertion is over the
    // whole array rather than a list somebody has to remember to extend.
    for (const { route } of routes) {
      const res = await request(
        route.method.toUpperCase(),
        concretePath(route.path),
      );

      expect([label(route), res.status]).toEqual([label(route), 403]);
    }
  });

  it("asks for exactly the documented permission on each route", async () => {
    const matrix: Record<string, string> = {};

    for (const { route } of routes) {
      asked = [];
      await request(route.method.toUpperCase(), concretePath(route.path));

      // One check per route, not two: a second would mean a route gated twice,
      // where only one of the two is visible in the AdminCP permission editor.
      expect([label(route), asked.length]).toEqual([label(route), 1]);
      expect(asked[0].module).toBe(MODULE);
      matrix[label(route)] = asked[0].permission;
    }

    expect(matrix).toEqual({
      "DELETE /{id}": "can_delete",
      "DELETE /{id}/translations/{locale}": "can_delete",
      "GET /": "can_view",
      "GET /options/{field}": "can_view",
      "GET /{id}": "can_view",
      // Read-only: it reports what the slug mutations already did, so the
      // permission that allowed the mutation is the only one it needs. There is
      // no manual redirect manager to gate separately.
      "GET /{id}/delivery": "can_view",
      "GET /{id}/public-locales": "can_view",
      "GET /{id}/revisions": "can_view",
      "GET /{id}/revisions/{revisionId}": "can_view",
      "GET /{id}/schedules": "can_view",
      "GET /{id}/translations": "can_view",
      "GET /{id}/translations/{locale}": "can_view",
      "GET /{id}/translations/{locale}/revisions": "can_view",
      "GET /{id}/translations/{locale}/revisions/{revisionId}": "can_view",
      "POST /": "can_create",
      // The composite create the AdminCP form posts to. `can_create`, exactly
      // like the plain one - it writes the same base row, plus the default
      // translation the engine has always required alongside it.
      "POST /localized": "can_create",
      "POST /{id}/preview": "can_view",
      "POST /{id}/publish": "can_publish",
      "POST /{id}/revisions/{revisionId}/restore": "can_restore",
      "POST /{id}/schedule": "can_publish",
      "POST /{id}/schedule/{scheduleId}/cancel": "can_publish",
      // Writing a language is editing the record, so it is the same permission
      // the shared `PUT` asks for. There is no translation permission.
      "POST /{id}/translations/{locale}": "can_edit",
      "POST /{id}/translations/{locale}/preview": "can_view",
      "POST /{id}/translations/{locale}/publish": "can_publish",
      "POST /{id}/translations/{locale}/revisions/{revisionId}/restore":
        "can_restore",
      "POST /{id}/translations/{locale}/unpublish": "can_publish",
      "POST /{id}/unpublish": "can_publish",
      "PUT /{id}": "can_edit",
      // The composite save. One check for the shared half and every language,
      // because one Save button writes one record.
      "PUT /{id}/localized": "can_edit",
      "PUT /{id}/translations/{locale}": "can_edit",
    });
  });

  /**
   * `can_edit` writes the record in every language it has, and stops there.
   *
   * There is no translation permission: a language is not a second kind of
   * field, it is the same record written in another locale, so the pair worth
   * pinning is edit against everything edit is *not*. Somebody who could reach
   * the publish routes on an edit permission could put an unfinished record on
   * the internet, and one who could reach `restore` could rewrite a record from
   * a version they never typed.
   */
  describe("editor isolation", () => {
    const EDITOR = [`${MODULE}:can_view`, `${MODULE}:can_edit`];

    const statusFor = async (method: string, path: string) => {
      granted = new Set(EDITOR);

      return (await request(method, path)).status;
    };

    it.each([
      ["POST", "/"],
      ["DELETE", "/7"],
      ["POST", "/7/publish"],
      ["POST", "/7/unpublish"],
      ["POST", "/7/revisions/3/restore"],
      // A shared revision *and* a locale's own: `can_restore` depends on
      // `can_edit` and is still its own grant on top of it.
      ["POST", "/7/translations/pl/revisions/3/restore"],
      ["POST", "/7/schedule"],
      ["POST", "/7/schedule/5/cancel"],
      ["DELETE", "/7/translations/en"],
      ["POST", "/7/translations/en/publish"],
      ["POST", "/7/translations/en/unpublish"],
    ])("refuses %s %s", async (method, path) => {
      await expect(statusFor(method, path)).resolves.toBe(403);
    });

    it.each([
      ["PUT", "/7"],
      ["PUT", "/7/localized"],
      ["POST", "/7/translations/pl"],
      ["PUT", "/7/translations/pl"],
    ])("reaches %s %s", async (method, path) => {
      // Past the guard is all this asserts. What the handler then does with a
      // record that is not there belongs to the translation suites.
      await expect(statusFor(method, path)).resolves.not.toBe(403);
    });

    it.each([
      ["GET", "/"],
      ["GET", "/7/translations"],
      ["GET", "/7/translations/en/revisions"],
    ])("still reads %s %s", async (method, path) => {
      await expect(statusFor(method, path)).resolves.not.toBe(403);
    });
  });

  /**
   * A collection is written through the ordinary `PUT`, and that is the whole
   * answer to "can a relation picker be a write primitive".
   *
   * There is no per-collection mutation endpoint to gate separately, so an
   * editor with `can_view` alone cannot add a category by any route - and the
   * picker itself is a read of labels, gated on `can_view` like every other
   * read.
   */
  describe("advanced collections have no second door", () => {
    it("exposes no route outside the audited set", () => {
      const paths = routes.map(entry => label(entry.route));

      expect(
        paths.filter(
          path => path.includes("relations") || path.includes("repeatable"),
        ),
      ).toEqual([]);
    });

    it("refuses a collection write to a viewer", async () => {
      granted = new Set([`${MODULE}:can_view`]);

      const res = await app.request("/7", {
        body: JSON.stringify({
          expectedVersion: 1,
          values: { faq: [{ answer: "Yes", question: "Really?" }] },
        }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });

      expect(res.status).toBe(403);
    });

    it("lets a viewer open the picker, which reads labels and writes nothing", async () => {
      granted = new Set([`${MODULE}:can_view`]);
      vi.spyOn(model, "service").mockReturnValue({
        options: async () => await Promise.resolve([]),
      } as never);

      const res = await app.request("/options/author");

      expect(res.status).toBe(200);
      vi.restoreAllMocks();
    });
  });

  /**
   * Two plugins can name a permission module the same thing - `articles` is not
   * an unusual choice - and the registry allows it precisely because the plugin
   * id is part of the key. That only holds if the *route* carries its own
   * plugin id into the check rather than reading whichever plugin happens to be
   * handling the request.
   */
  describe("cross-plugin isolation", () => {
    it("checks the permission under the route's own plugin", async () => {
      for (const { route } of routes) {
        asked = [];
        await request(route.method.toUpperCase(), concretePath(route.path));

        expect([label(route), asked[0].plugin]).toEqual([
          label(route),
          PLUGIN_ID,
        ]);
      }
    });

    it("does not follow the plugin the request is being served by", async () => {
      // The same model, mounted by a second plugin. Its routes ask under
      // `@vitnode/other`, so granting `@vitnode/example`'s module grants
      // nothing here - which is what stops one plugin's roles reaching another
      // plugin's content through a module name they happen to share.
      const other = new OpenAPIHono();
      other.use("*", async (c, next) => {
        c.set("admin", { user: adminUser });
        await next();
      });
      for (const { handler, route } of buildContentRoutes(model, {
        pluginId: "@vitnode/other",
      })) {
        other.openapi(route, handler);
      }

      asked = [];
      granted = new Set([`${MODULE}:can_view`]);
      vi.spyOn(model, "service").mockReturnValue({
        findMany: async () =>
          await Promise.resolve({ edges: [], pageInfo: {} }),
      } as never);
      const res = await other.request("/");
      vi.restoreAllMocks();

      // Granted by module name - the module is the same string - and the check
      // still ran under the other plugin, which is the fact worth pinning.
      expect(res.status).not.toBe(403);
      expect(asked[0]).toMatchObject({
        module: MODULE,
        permission: "can_view",
        plugin: "@vitnode/other",
      });
    });
  });
});
