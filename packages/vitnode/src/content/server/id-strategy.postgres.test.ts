// @vitest-environment node
import type { Context, MiddlewareHandler } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { and, asc, eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { createTranslator } from "use-intl";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { SearchDocument } from "@/api/models/search";
import type { ContentScheduleEffectsPayload } from "@/content/server/schedule-effects";

import { executeContentSchedule } from "@/api/modules/content/helpers/execute-content-schedule";
import {
  core_content_file_refs,
  core_content_revisions,
  core_content_schedules,
  core_content_slug_history,
} from "@/database/content";
import { core_files } from "@/database/files";
import { core_languages } from "@/database/languages";
import { core_roles } from "@/database/roles";
import { core_users } from "@/database/users";
import apiMessages from "@/locales/api/en.json";
import { createTestCache } from "@/tests/cache";
import {
  testBigintEventContentType,
  testBigintPageContentType,
  testCategoryContentType,
  testContentLocaleRouting,
  testEditorialNoteContentType,
  testUuidTagContentType,
} from "@/tests/content-fixtures";
import {
  createTestDatabase,
  describePostgres,
  type TestDatabaseHandle,
} from "@/tests/postgres";
import { grantStaffPermissions } from "@/tests/staff-permissions";

import { contentInvalidationTags, contentPublicItemTag } from "../cache";
import { CONTENT_PERMISSIONS } from "../const";
import {
  type ContentDeliverySitemapPage,
  readContentDeliverySitemapPage,
} from "./delivery-sitemap";
import { createContentModel } from "./model";
import { buildContentPublicRoutes } from "./public-routes";
import { buildContentRoutes } from "./routes";
import {
  createContentLocalizedSearchIndexer,
  createContentSearchIndexer,
} from "./search-indexer";

const PLUGIN_ID = "@vitnode/test";
const PREVIEW_SECRET = "id-strategy-test-preview-secret-0123456789";
const STAFF_ID = 1;
const ACTOR = { type: "staff", userId: STAFF_ID } as const;

/** One past `Number.MAX_SAFE_INTEGER`: a `Number` round trip would change it. */
const BEYOND_SAFE = "9007199254740993";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const categories = createContentModel(testCategoryContentType);
const tags = createContentModel(testUuidTagContentType, {
  references: { category: () => categories.table.id },
});
const events = createContentModel(testBigintEventContentType, {
  references: {
    category: () => categories.table.id,
    primaryTag: () => tags.table.id,
    tags: () => tags.table.id,
  },
});
const pages = createContentModel(testBigintPageContentType);
const notes = createContentModel(testEditorialNoteContentType);

const MODELS = [categories, tags, events, pages, notes] as const;

interface Emitted {
  name: string;
  payload: Record<string, unknown>;
}

const json = async <T = Record<string, unknown>>(
  response: Response,
): Promise<T> => (await response.json()) as T;

describePostgres("content id strategies against Postgres", () => {
  let database: TestDatabaseHandle;
  let emitted: Emitted[] = [];
  let indexed: SearchDocument[] = [];
  let deleted: unknown[][] = [];
  let dispatched: ContentScheduleEffectsPayload[] = [];
  let cache = createTestCache();

  const vars = (): Map<string, unknown> =>
    new Map<string, unknown>([
      ["admin", { user: { id: STAFF_ID, roleId: 1 } }],
      ["cache", cache],
      [
        "core",
        {
          contentModels: MODELS.map(model => ({ model, pluginId: PLUGIN_ID })),
          contentPreviewSecret: PREVIEW_SECRET,
          contentRevalidateOrigins: [],
          i18n: {
            defaultLocale: "en",
            localeRouting: testContentLocaleRouting(),
            locales: [{ code: "en" }, { code: "pl" }],
          },
        },
      ],
      ["db", database.db],
      [
        "events",
        {
          emit: async (name: string, payload: Record<string, unknown>) => {
            emitted.push({ name, payload });

            return await Promise.resolve({
              delivered: 0,
              eventId: `event-${emitted.length}`,
              failures: [],
            });
          },
        },
      ],
      [
        "i18n",
        {
          getTranslator: async (locale: string) =>
            await Promise.resolve(
              createTranslator({ locale, messages: apiMessages }),
            ),
          resolveLocale: () => "en",
          resolveSupportedLocale: () => "en",
        },
      ],
      [
        "log",
        {
          debug: async () => {},
          error: async () => {},
          info: async () => {},
          warn: async () => {},
        },
      ],
      [
        "queue",
        {
          dispatch: async ({
            payload,
          }: {
            payload: ContentScheduleEffectsPayload;
          }) => {
            dispatched.push(payload);

            return await Promise.resolve({ id: dispatched.length });
          },
        },
      ],
      [
        "search",
        {
          delete: async (...args: unknown[]) => {
            deleted.push(args);
            await Promise.resolve();
          },
          index: async (document: SearchDocument) => {
            indexed.push(document);
            await Promise.resolve();
          },
        },
      ],
      ["user", null],
    ]);

  /** A fresh request context: the language registry is cached per context. */
  const context = (): Context => {
    const store = vars();

    return {
      get: (key: string) => store.get(key),
      set: (key: string, value: unknown) => store.set(key, value),
    } as unknown as Context;
  };

  const app = (() => {
    const instance = new OpenAPIHono();
    const middleware: MiddlewareHandler = async (c, next) => {
      for (const [key, value] of vars()) c.set(key as never, value as never);
      await next();
    };
    instance.use("*", middleware);
    // What the API app does: a refusal answers with its own status, and
    // anything else is the 500 these tests exist to rule out.
    instance.onError((err, c) =>
      err instanceof HTTPException
        ? err.getResponse()
        : c.text("Internal Server Error", 500),
    );

    const mount = (
      prefix: string,
      routes: { handler: unknown; route: unknown }[],
    ): void => {
      const sub = new OpenAPIHono();
      for (const { handler, route } of routes) {
        sub.openapi(route as never, handler as never);
      }
      instance.route(prefix, sub);
    };

    for (const model of [tags, events, pages] as const) {
      mount(
        `/${model.definition.permissionModule}`,
        buildContentRoutes(model as typeof events, {
          pluginId: PLUGIN_ID,
        }),
      );
      mount(
        `/public/${model.definition.publicApi.path}`,
        buildContentPublicRoutes(model as typeof events, {
          pluginId: PLUGIN_ID,
        }),
      );
    }

    return instance;
  })();

  const TAGS = `/${tags.definition.permissionModule}`;
  const EVENTS = `/${events.definition.permissionModule}`;
  const PAGES = `/${pages.definition.permissionModule}`;

  const request = async (
    method: string,
    path: string,
    body?: unknown,
  ): Promise<Response> =>
    await app.request(path, {
      method,
      ...(body === undefined || method === "GET"
        ? {}
        : {
            body: JSON.stringify(body),
            headers: { "Content-Type": "application/json" },
          }),
    });

  const eventEditorial = (c = context()) => {
    const build = events.editorialService;
    if (!build) throw new Error("events are editorial");

    return build(c, { pluginId: PLUGIN_ID });
  };

  const tagEditorial = (c = context()) => {
    const build = tags.editorialService;
    if (!build) throw new Error("tags are editorial");

    return build(c, { pluginId: PLUGIN_ID });
  };

  const createCategory = async (title: string): Promise<number> =>
    (await categories.service(context()).create({ title })).id;

  const createTag = async (name: string): Promise<string> => {
    const response = await request("POST", `${TAGS}/localized`, {
      translations: [{ locale: "en", values: { name } }],
      values: {},
    });
    expect(response.status).toBe(201);

    return (await json<{ id: string }>(response)).id;
  };

  const createEvent = async (
    values: Record<string, unknown>,
  ): Promise<{ id: string; version: number }> => {
    const response = await request("POST", EVENTS, values);
    expect(response.status).toBe(201);

    return await json<{ id: string; version: number }>(response);
  };

  const revisionKeys = async (contentTypeId: string): Promise<string[]> =>
    (
      await database.db
        .select({ itemId: core_content_revisions.itemId })
        .from(core_content_revisions)
        .where(eq(core_content_revisions.contentTypeId, contentTypeId))
    ).map(row => row.itemId);

  const grant = async (permissions: string[]) => {
    cache = createTestCache();
    await grantStaffPermissions(cache, {
      permissions: [tags, events, pages].flatMap(model =>
        permissions.map(permission => ({
          module: model.definition.permissionModule,
          permission,
          plugin: PLUGIN_ID,
        })),
      ),
      userId: STAFF_ID,
    });
  };

  beforeAll(async () => {
    database = await createTestDatabase({
      categories: categories.table,
      core_content_file_refs,
      core_content_revisions,
      core_content_schedules,
      core_content_slug_history,
      core_files,
      core_languages,
      core_roles,
      core_users,
      events: events.table,
      notes: notes.table,
      pages: pages.table,
      pageTranslations: pages.translationTable,
      tags: tags.table,
      tagTranslations: tags.translationTable,
      ...Object.fromEntries(
        [tags, events]
          .flatMap(model => [
            ...Object.values(model.advancedTables.junctions),
            ...Object.values(model.advancedTables.repeatables),
          ])
          .map((table, index) => [`advanced${index}`, table]),
      ),
    });

    await database.db.insert(core_roles).values({ id: 1 });
    await database.db.insert(core_languages).values([
      { code: "en", default: true, name: "English", timezone: "UTC" },
      { code: "pl", name: "Polski", timezone: "UTC" },
    ]);
    await database.db.insert(core_users).values({
      avatarColor: "000000",
      email: "staff@example.com",
      id: STAFF_ID,
      ipAddress: "127.0.0.1",
      language: "en",
      name: "Staff",
      nameCode: "staff",
      roleId: 1,
    });

    // Every bigint id from here on is beyond `Number.MAX_SAFE_INTEGER`.
    await database.db.execute(
      sql.raw(
        `select setval(pg_get_serial_sequence('test_bigint_events', 'id'), ${BEYOND_SAFE})`,
      ),
    );
    await database.db.execute(
      sql.raw(
        `select setval(pg_get_serial_sequence('test_bigint_pages', 'id'), ${BEYOND_SAFE})`,
      ),
    );
  }, 60_000);

  afterAll(async () => {
    await database?.drop();
  });

  beforeEach(async () => {
    emitted = [];
    indexed = [];
    deleted = [];
    dispatched = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => await Promise.resolve(new Response("ok"))),
    );
    await grant(Object.values(CONTENT_PERMISSIONS));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("bigint above Number.MAX_SAFE_INTEGER", () => {
    it("keeps the exact decimal string through the routes, history, events, search and cache tags", async () => {
      const created = await createEvent({ title: "Launch" });

      expect(created.id).toBe("9007199254740994");
      expect(typeof created.id).toBe("string");

      const detail = await json(
        await request("GET", `${EVENTS}/${created.id}`),
      );
      expect(detail.id).toBe("9007199254740994");

      const updated = await request("PUT", `${EVENTS}/${created.id}`, {
        expectedVersion: created.version,
        values: { title: "Launch party" },
      });
      expect(updated.status).toBe(200);
      expect((await json(updated)).id).toBe("9007199254740994");

      const published = await request(
        "POST",
        `${EVENTS}/${created.id}/publish`,
      );
      expect(published.status).toBe(200);

      // The shared history stores the key, and reads it back by it.
      expect(await revisionKeys(events.definition.id)).toEqual([
        "9007199254740994",
        "9007199254740994",
        "9007199254740994",
      ]);
      const history = await json<{ edges: { version: number }[] }>(
        await request("GET", `${EVENTS}/${created.id}/revisions`),
      );
      expect(history.edges.map(edge => edge.version)).toEqual([3, 2, 1]);

      expect(
        emitted.find(entry => entry.name.endsWith(".created"))?.payload,
      ).toMatchObject({ contentId: "9007199254740994" });
      expect(
        emitted.find(entry => entry.name.endsWith(".published"))?.payload,
      ).toMatchObject({ contentId: "9007199254740994" });

      const document = indexed.at(-1);
      expect(document?.itemId).toBe("9007199254740994");
      expect(document?.isPublic).toBe(true);

      expect(contentPublicItemTag(events.definition.id, created.id)).toBe(
        "content:test.bigint-event:item:9007199254740994",
      );
      expect(
        contentInvalidationTags({
          contentTypeId: events.definition.id,
          id: created.id,
          isPublic: true,
          slugs: [],
          wasPublic: false,
        }),
      ).toContain("content:test.bigint-event:item:9007199254740994");
    });

    it("serves the public projection, delivery and a signed preview with string ids", async () => {
      const created = await createEvent({ title: "Public bigint" });
      await request("POST", `${EVENTS}/${created.id}/publish`);

      const list = await json<{ edges: { id: string }[] }>(
        await request("GET", "/public/bigint-events"),
      );
      expect(list.edges.map(row => row.id)).toContain(created.id);

      const bySlug = await json(
        await request("GET", "/public/bigint-events/public-bigint"),
      );
      expect(bySlug.id).toBe(created.id);

      const metadata = await json(
        await request(
          "GET",
          `/public/bigint-events/delivery/item/${created.id}`,
        ),
      );
      expect(metadata.itemId).toBe(created.id);

      const preview = await json<{ token: string }>(
        await request("POST", `${EVENTS}/${created.id}/preview`),
      );
      const previewed = await request(
        "GET",
        `/public/bigint-events/preview/${preview.token}`,
      );
      expect(previewed.status).toBe(200);
      expect((await json(previewed)).id).toBe(created.id);
    });

    it("pages the admin list, the public list, the sitemap and the search rebuild by the bigint key", async () => {
      const first = await createEvent({ title: "Paged one" });
      const second = await createEvent({ title: "Paged two" });
      await request("POST", `${EVENTS}/${first.id}/publish`);
      await request("POST", `${EVENTS}/${second.id}/publish`);

      const seen: string[] = [];
      let cursor: null | string = null;
      for (let page = 0; page < 20; page += 1) {
        const query: string =
          cursor === null
            ? "?first=1&orderBy=id&order=asc"
            : `?first=1&orderBy=id&order=asc&cursor=${cursor}`;
        const body = await json<{
          edges: { id: string }[];
          pageInfo: { endCursor: null | string; hasNextPage: boolean };
        }>(await request("GET", `${EVENTS}${query}`));
        seen.push(...body.edges.map(row => row.id));
        if (!body.pageInfo.hasNextPage) break;
        cursor = body.pageInfo.endCursor;
      }
      expect(seen).toEqual(
        [...seen].sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1)),
      );
      expect(seen).toEqual(expect.arrayContaining([first.id, second.id]));
      expect(new Set(seen).size).toBe(seen.length);

      const sitemapIds: (number | string)[] = [];
      let sitemapCursor: null | number | string = null;
      for (let page = 0; page < 20; page += 1) {
        const result: ContentDeliverySitemapPage =
          await readContentDeliverySitemapPage({
            args: {
              limit: 1,
              ...(sitemapCursor === null ? {} : { cursor: sitemapCursor }),
            },
            c: context(),
            model: events,
          });
        sitemapIds.push(...result.entries.map(entry => entry.itemId));
        if (result.nextCursor === null) break;
        expect(typeof result.nextCursor).toBe("string");
        sitemapCursor = result.nextCursor;
      }
      expect(sitemapIds).toEqual(expect.arrayContaining([first.id, second.id]));
      expect(new Set(sitemapIds).size).toBe(sitemapIds.length);

      const sitemapRoute = await json<{ nextCursor: null | string }>(
        await request("GET", "/public/bigint-events/delivery/sitemap?limit=1"),
      );
      expect(typeof sitemapRoute.nextCursor).toBe("string");

      const indexer = createContentSearchIndexer(events, {
        pluginId: PLUGIN_ID,
      });
      const c = context();
      const rebuilt: (number | string)[] = [];
      for (let offset = 0; offset < 50; offset += 1) {
        const { documents, itemsRead } = await indexer.load(c, offset, 1);
        if (itemsRead === 0) break;
        rebuilt.push(...documents.map(document => document.itemId));
      }
      expect(rebuilt).toEqual(expect.arrayContaining([first.id, second.id]));
      expect(new Set(rebuilt).size).toBe(rebuilt.length);
    });

    it("runs a schedule keyed by the bigint key and announces it with the string id", async () => {
      const created = await createEvent({ title: "Scheduled bigint" });
      const scheduled = await request(
        "POST",
        `${EVENTS}/${created.id}/schedule`,
        {
          action: "publish",
          scheduledFor: new Date(Date.now() + 60_000).toISOString(),
        },
      );
      expect(scheduled.status).toBe(200);
      const { id: scheduleId } = await json<{ id: number }>(scheduled);

      const [stored] = await database.db
        .select()
        .from(core_content_schedules)
        .where(eq(core_content_schedules.id, scheduleId));
      expect(stored.itemId).toBe(created.id);

      await database.db
        .update(core_content_schedules)
        .set({ scheduledFor: new Date(Date.now() - 1000) })
        .where(eq(core_content_schedules.id, scheduleId));

      expect(
        await executeContentSchedule(context(), {
          generation: stored.generation,
          scheduleId,
        }),
      ).toEqual({ status: "executed" });

      const row = await eventEditorial().revisions.latest(created.id);
      expect(row?.operation).toBe("publish");
      expect(dispatched.at(-1)?.itemId).toBe(created.id);

      const listed = await json<{ edges: unknown[] }>(
        await request("GET", `${EVENTS}/${created.id}/schedules`),
      );
      expect(listed.edges).toHaveLength(1);
    });

    it("keeps a bigint translation's item id, alternates and public locales exact", async () => {
      const response = await request("POST", `${PAGES}/localized`, {
        translations: [
          { locale: "en", values: { title: "Home" } },
          { locale: "pl", values: { title: "Dom" } },
        ],
        values: {},
      });
      expect(response.status).toBe(201);
      const { id } = await json<{ id: string }>(response);
      expect(BigInt(id) > BigInt(BEYOND_SAFE)).toBe(true);

      const translations = await json<{ edges: { itemId: string }[] }>(
        await request("GET", `${PAGES}/${id}/translations`),
      );
      expect(translations.edges.map(edge => edge.itemId)).toEqual([id, id]);

      await request("POST", `${PAGES}/${id}/publish`);
      await request("POST", `${PAGES}/${id}/translations/pl/publish`, {});

      const locales = await json<{ edges: { locale: string }[] }>(
        await request("GET", `${PAGES}/${id}/public-locales`),
      );
      expect(locales.edges.map(edge => edge.locale).sort()).toEqual([
        "en",
        "pl",
      ]);

      const metadata = await json<{
        alternates: { locale: string }[];
        itemId: string;
      }>(
        await request(
          "GET",
          `/public/bigint-pages/delivery/item/${id}?locale=pl`,
        ),
      );
      expect(metadata.itemId).toBe(id);
      expect(metadata.alternates.map(entry => entry.locale)).toEqual([
        "en",
        "pl",
      ]);

      const indexer = createContentLocalizedSearchIndexer(pages, {
        pluginId: PLUGIN_ID,
      });
      const { documents } = await indexer.load(context(), 0, 10);
      expect(documents.filter(document => document.itemId === id).length).toBe(
        2,
      );
    });
  });

  describe("uuid records", () => {
    it("generates a canonical uuid and reads it back everywhere", async () => {
      const id = await createTag("Science");
      expect(id).toMatch(UUID);

      const detail = await request("GET", `${TAGS}/${id}`);
      expect(detail.status).toBe(200);
      expect((await json(detail)).id).toBe(id);

      const translated = await request(
        "POST",
        `${TAGS}/${id}/translations/pl`,
        { values: { name: "Nauka" } },
      );
      expect(translated.status).toBe(201);
      const rows = await json<{ edges: { itemId: string }[] }>(
        await request("GET", `${TAGS}/${id}/translations`),
      );
      expect(rows.edges.map(edge => edge.itemId)).toEqual([id, id]);

      expect(await revisionKeys(tags.definition.id)).toContain(id);
    });

    it("answers 404 for a well-formed uuid that names nothing", async () => {
      const missing = "00000000-0000-4000-8000-000000000000";

      expect((await request("GET", `${TAGS}/${missing}`)).status).toBe(404);
    });

    it("refuses a self-relation to a missing record before writing", async () => {
      const id = await createTag("Lonely");
      const response = await request("PUT", `${TAGS}/${id}`, {
        expectedVersion: 1,
        values: { relatedTags: ["00000000-0000-4000-8000-000000000001"] },
      });

      expect(response.status).toBe(400);
    });

    it("keeps a self-relation's order and its serial to-one relation", async () => {
      const categoryId = await createCategory("Topics");
      const first = await createTag("First");
      const second = await createTag("Second");
      const owner = await createTag("Owner");

      const result = await tagEditorial().update(
        owner,
        { category: categoryId, relatedTags: [second, first] },
        { actor: ACTOR, expectedVersion: 1 },
      );
      expect(result?.row.category).toBe(categoryId);

      const detail = await json<{ category: number; relatedTags: string[] }>(
        await request("GET", `${TAGS}/${owner}`),
      );
      expect(detail.relatedTags).toEqual([second, first]);
      expect(detail.category).toBe(categoryId);

      await request("POST", `${TAGS}/${owner}/publish`);
      const filtered = await json<{ edges: { id: string }[] }>(
        await request("GET", `/public/uuid-tags?relatedTags=${first}`),
      );
      expect(filtered.edges.map(row => row.id)).toEqual([owner]);

      const projected = await json<{
        category: { id: number };
        relatedTags: string[];
      }>(await request("GET", "/public/uuid-tags/owner"));
      expect(projected.category).toEqual({ id: categoryId });
      expect(projected.relatedTags).toEqual([second, first]);
    });

    it("duplicates, hides and unhides a uuid record with every translation", async () => {
      const id = await createTag("Original");
      await request("POST", `${TAGS}/${id}/translations/pl`, {
        values: { name: "Oryginał" },
      });

      const response = await request("POST", `${TAGS}/${id}/duplicate`, {});
      expect(response.status).toBe(201);
      const copy = await json<{
        id: string;
        locales: string[];
        sourceId: string;
      }>(response);
      expect(copy.id).toMatch(UUID);
      expect(copy.id).not.toBe(id);
      expect(copy.sourceId).toBe(id);
      expect(copy.locales).toEqual(["en", "pl"]);
      expect(
        emitted.find(entry => entry.name.endsWith(".duplicated"))?.payload,
      ).toMatchObject({ contentId: copy.id, sourceId: id });

      await request("POST", `${TAGS}/${id}/publish`);
      expect((await request("POST", `${TAGS}/${id}/hide`)).status).toBe(200);
      expect((await request("GET", "/public/uuid-tags/original")).status).toBe(
        404,
      );
      expect(
        emitted.find(entry => entry.name.endsWith(".hidden"))?.payload,
      ).toMatchObject({ contentId: id });

      expect((await request("POST", `${TAGS}/${id}/unhide`)).status).toBe(200);
      expect((await request("GET", "/public/uuid-tags/original")).status).toBe(
        200,
      );
    });

    it("previews a uuid record through a signed token", async () => {
      const id = await createTag("Previewed");
      const token = await json<{ token: string }>(
        await request("POST", `${TAGS}/${id}/preview`),
      );

      const previewed = await request(
        "GET",
        `/public/uuid-tags/preview/${token.token}`,
      );
      expect(previewed.status).toBe(200);
      expect((await json(previewed)).id).toBe(id);
    });
  });

  describe("relations across strategies", () => {
    it("stores and returns a uuid, a serial and a bigint target in order", async () => {
      const categoryId = await createCategory("Conferences");
      const first = await createTag("Talks");
      const second = await createTag("Workshops");
      const other = await createEvent({ title: "Other event" });

      const created = await createEvent({
        category: categoryId,
        primaryTag: second,
        relatedEvents: [other.id],
        sessions: [{ title: "Keynote" }, { title: "Panel" }],
        tags: [second, first],
        title: "Conference",
      });

      const detail = await json<{
        category: number;
        primaryTag: string;
        relatedEvents: string[];
        sessions: { id: number; title: string }[];
        tags: string[];
      }>(await request("GET", `${EVENTS}/${created.id}`));
      expect(detail.category).toBe(categoryId);
      expect(detail.primaryTag).toBe(second);
      expect(detail.tags).toEqual([second, first]);
      expect(detail.relatedEvents).toEqual([other.id]);
      expect(detail.sessions.map(row => row.title)).toEqual([
        "Keynote",
        "Panel",
      ]);
      expect(detail.sessions.every(row => typeof row.id === "number")).toBe(
        true,
      );

      // The junctions are typed by both sides: a bigint owner and a uuid target.
      const junction = Object.values(events.advancedTables.junctions)[0];
      const rows = await database.db
        .select()
        .from(junction)
        .orderBy(asc(junction.position));
      expect(rows.some(row => row.relatedItemId === second)).toBe(true);

      const labels = await json<{ items: { value: string }[] }>(
        await request(
          "GET",
          `${EVENTS}/options/tags?ids=${first},${second},NOT-A-UUID`,
        ),
      );
      expect(labels.items.map(item => item.value).sort()).toEqual(
        [first, second].sort(),
      );

      const filtered = await json<{ edges: { id: string }[] }>(
        await request("GET", `${EVENTS}?tags=${first}`),
      );
      expect(filtered.edges.map(row => row.id)).toEqual([created.id]);
      expect((await request("GET", `${EVENTS}?tags=nope`)).status).toBe(400);

      await request("POST", `${EVENTS}/${created.id}/publish`);
      const projected = await json<{
        category: { id: number };
        primaryTag: { id: string };
        relatedEvents: string[];
        tags: string[];
      }>(await request("GET", "/public/bigint-events/conference"));
      expect(projected.primaryTag).toEqual({ id: second });
      expect(projected.category).toEqual({ id: categoryId });
      expect(projected.tags).toEqual([second, first]);
      expect(projected.relatedEvents).toEqual([other.id]);
    });

    it("enforces the foreign key to a uuid target", async () => {
      const response = await request("POST", EVENTS, {
        primaryTag: "00000000-0000-4000-8000-000000000002",
        title: "Orphaned",
      });

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.status).toBeLessThan(500);
    });

    it("runs the collection API on string ids, and restores an older set from history", async () => {
      const first = await createTag("Alpha");
      const second = await createTag("Beta");
      const created = await createEvent({ tags: [first], title: "Collected" });
      const editorial = eventEditorial();

      const added = await editorial.relations.tags.add(created.id, second, {
        actor: ACTOR,
        expectedVersion: created.version,
      });
      expect(await editorial.relations.tags.get(created.id)).toEqual([
        first,
        second,
      ]);

      await editorial.relations.tags.reorder(created.id, [second, first], {
        actor: ACTOR,
        expectedVersion: added?.version ?? 0,
      });
      expect(await editorial.relations.tags.get(created.id)).toEqual([
        second,
        first,
      ]);

      const history = await editorial.revisions.list(created.id);
      const original = history.edges.find(edge => edge.version === 1);
      if (!original) throw new Error("expected the create revision");

      const restored = await request(
        "POST",
        `${EVENTS}/${created.id}/revisions/${original.id}/restore`,
        { expectedVersion: 3 },
      );
      expect(restored.status).toBe(200);
      expect(await editorial.relations.tags.get(created.id)).toEqual([first]);
    });

    it("duplicates, hides and unhides a bigint record with its collections", async () => {
      const tag = await createTag("Gamma");
      const source = await createEvent({
        sessions: [{ title: "Morning" }, { title: "Evening" }],
        tags: [tag],
        title: "Copied",
      });

      const response = await request(
        "POST",
        `${EVENTS}/${source.id}/duplicate`,
        {},
      );
      expect(response.status).toBe(201);
      const copy = await json<{ id: string; sourceId: string }>(response);
      expect(copy.sourceId).toBe(source.id);
      expect(BigInt(copy.id) > BigInt(source.id)).toBe(true);

      const detail = await json<{
        sessions: { id: number; title: string }[];
        tags: string[];
      }>(await request("GET", `${EVENTS}/${copy.id}`));
      const original = await json<{ sessions: { id: number }[] }>(
        await request("GET", `${EVENTS}/${source.id}`),
      );
      expect(detail.tags).toEqual([tag]);
      expect(detail.sessions.map(row => row.title)).toEqual([
        "Morning",
        "Evening",
      ]);
      expect(
        detail.sessions.some(row =>
          original.sessions.some(entry => entry.id === row.id),
        ),
      ).toBe(false);

      await request("POST", `${EVENTS}/${source.id}/publish`);
      const hidden = await json<{ row: { hiddenAt: null | string } }>(
        await request("POST", `${EVENTS}/${source.id}/hide`),
      );
      expect(hidden.row.hiddenAt).not.toBeNull();
      expect(
        (await request("GET", "/public/bigint-events/copied")).status,
      ).toBe(404);
      expect(
        (await request("POST", `${EVENTS}/${source.id}/unhide`)).status,
      ).toBe(200);
      expect(
        (await request("GET", "/public/bigint-events/copied")).status,
      ).toBe(200);
    });

    it("redirects a bigint record's historical slug", async () => {
      const created = await createEvent({ title: "Old name" });
      await request("POST", `${EVENTS}/${created.id}/publish`);
      await request("PUT", `${EVENTS}/${created.id}`, {
        expectedVersion: 2,
        values: { slug: "new-name" },
      });

      const [history] = await database.db
        .select({ itemId: core_content_slug_history.itemId })
        .from(core_content_slug_history)
        .where(
          and(
            eq(core_content_slug_history.contentTypeId, events.definition.id),
            eq(core_content_slug_history.slug, "old-name"),
          ),
        );
      expect(history.itemId).toBe(created.id);

      const resolution = await json<{ location: string; type: string }>(
        await request("GET", "/public/bigint-events/delivery/resolve/old-name"),
      );
      expect(resolution.type).toBe("redirect");
      expect(resolution.location).toContain("new-name");
    });
  });

  describe("malformed identifiers", () => {
    const badBigints = [
      "abc",
      "0",
      "-1",
      "1.5",
      "007",
      "1e3",
      "9223372036854775808",
      "99999999999999999999999",
    ];
    const badUuids = [
      "abc",
      "1",
      "00000000-0000-4000-8000-00000000000G",
      "AAAAAAAA-0000-4000-8000-000000000000",
      "{00000000-0000-4000-8000-000000000000}",
    ];
    const routes = (base: string, id: string) => [
      ["GET", `${base}/${id}`],
      ["PUT", `${base}/${id}`],
      ["DELETE", `${base}/${id}`],
      ["POST", `${base}/${id}/publish`],
      ["POST", `${base}/${id}/hide`],
      ["POST", `${base}/${id}/duplicate`],
      ["POST", `${base}/${id}/preview`],
      ["GET", `${base}/${id}/revisions`],
    ];

    it.each(badBigints)(
      "answers a bigint route given %o with a 400, never a 500",
      async id => {
        for (const [method, path] of [
          ...routes(EVENTS, id),
          ["GET", `${EVENTS}/${id}/schedules`],
          ["GET", `/public/bigint-events/delivery/item/${id}`],
        ]) {
          const response = await request(method, path, {
            expectedVersion: 1,
            values: { title: "x" },
          });
          expect([path, response.status]).toEqual([path, 400]);
        }
      },
    );

    it.each(badUuids)(
      "answers a uuid route given %o with a 400, never a 500",
      async id => {
        for (const [method, path] of [
          ...routes(TAGS, encodeURIComponent(id)),
          ["GET", `${TAGS}/${encodeURIComponent(id)}/translations`],
        ]) {
          const response = await request(method, path, {
            expectedVersion: 1,
            values: { name: "x" },
          });
          expect([path, response.status]).toEqual([path, 400]);
        }
      },
    );

    it("refuses a malformed sitemap cursor", async () => {
      expect(
        (
          await request(
            "GET",
            "/public/bigint-events/delivery/sitemap?cursor=nope",
          )
        ).status,
      ).toBe(400);
    });
  });

  describe("serial content types", () => {
    it("store the same digits in the shared tables they always held", async () => {
      const build = notes.editorialService;
      if (!build) throw new Error("notes are editorial");

      const created = await build(context(), { pluginId: PLUGIN_ID }).create(
        { title: "A serial note" },
        { actor: ACTOR },
      );

      expect(typeof created.row.id).toBe("number");
      expect(await revisionKeys(notes.definition.id)).toEqual([
        String(created.row.id),
      ]);
      const latest = await build(context(), {
        pluginId: PLUGIN_ID,
      }).revisions.latest(created.row.id);
      expect(latest?.version).toBe(1);
    });
  });
});
