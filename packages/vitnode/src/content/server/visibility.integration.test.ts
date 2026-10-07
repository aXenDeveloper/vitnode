// @vitest-environment node
import type { Context, MiddlewareHandler } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";
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
import { createTestCache } from "@/tests/cache";
import {
  testContentLocaleRouting,
  testHideableLocalizedContentType,
  testHideableNoteContentType,
  testHideablePostContentType,
} from "@/tests/content-fixtures";
import {
  createTestDatabase,
  describePostgres,
  type TestDatabaseHandle,
} from "@/tests/postgres";
import { grantStaffPermissions } from "@/tests/staff-permissions";

import { contentInvalidationTags, contentPublicItemTag } from "../cache";
import { CONTENT_PERMISSIONS } from "../const";
import { ContentVersionConflict } from "../errors";
import { readDeliveryAlternates } from "./delivery-alternates";
import { readContentDeliverySitemapPage } from "./delivery-sitemap";
import { createContentModel } from "./model";
import { createContentPreviewToken } from "./preview-token";
import { contentPublicLocaleStates } from "./public-locales";
import { buildContentPublicRoutes } from "./public-routes";
import { CONTENT_REVALIDATE_PATH } from "./revalidate-bridge";
import { buildContentRoutes } from "./routes";
import { runContentScheduleEffects } from "./schedule-effects";
import {
  createContentLocalizedSearchIndexer,
  createContentSearchIndexer,
} from "./search-indexer";
import { editorialVisibilityMethods } from "./visibility";
import { contentVisibilityEffects } from "./visibility-effects";

const PLUGIN_ID = "@vitnode/test";
const WEB = "https://web.example";
const PREVIEW_SECRET = "visibility-test-preview-secret-0123456789";
const STAFF_ID = 1;

const posts = createContentModel(testHideablePostContentType);
const pages = createContentModel(testHideableLocalizedContentType);
const notes = createContentModel(testHideableNoteContentType);

const ACTOR = { type: "staff", userId: STAFF_ID } as const;

interface Emitted {
  name: string;
  payload: Record<string, unknown>;
}

interface SearchCall {
  args?: unknown[];
  document?: SearchDocument;
  op: "delete" | "index";
}

describePostgres("record visibility against Postgres", () => {
  let database: TestDatabaseHandle;
  let emitted: Emitted[] = [];
  let searchCalls: SearchCall[] = [];
  let dispatched: ContentScheduleEffectsPayload[] = [];
  let fetchMock: ReturnType<typeof vi.fn>;
  let cache = createTestCache();

  const vars = (): Map<string, unknown> =>
    new Map<string, unknown>([
      ["admin", { user: { id: STAFF_ID, roleId: 1 } }],
      ["cache", cache],
      [
        "core",
        {
          contentModels: [
            { model: posts, pluginId: PLUGIN_ID },
            { model: pages, pluginId: PLUGIN_ID },
            { model: notes, pluginId: PLUGIN_ID },
          ],
          contentPreviewSecret: PREVIEW_SECRET,
          contentRevalidateOrigins: [WEB],
          cronSecret: "visibility-cron-secret",
          i18n: { localeRouting: testContentLocaleRouting() },
        },
      ],
      ["db", database.db],
      [
        "events",
        {
          emit: async (name: string, payload: Record<string, unknown>) => {
            emitted.push({ name, payload });

            return await Promise.resolve({ failures: [] });
          },
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
            searchCalls.push({ args, op: "delete" });
            await Promise.resolve();
          },
          index: async (document: SearchDocument) => {
            searchCalls.push({ document, op: "index" });
            await Promise.resolve();
          },
        },
      ],
      ["user", null],
    ]);

  /** A fresh request: the language registry is cached per context. */
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
    for (const { handler, route } of [
      ...buildContentRoutes(posts, { pluginId: PLUGIN_ID }),
      ...buildContentRoutes(notes, { pluginId: PLUGIN_ID }).map(entry => ({
        ...entry,
        route: { ...entry.route, path: `/notes${entry.route.path}` },
      })),
      ...buildContentPublicRoutes(posts, { pluginId: PLUGIN_ID }).map(
        entry => ({
          ...entry,
          route: { ...entry.route, path: `/public${entry.route.path}` },
        }),
      ),
    ]) {
      instance.openapi(route as never, handler as never);
    }

    return instance;
  })();

  const grant = async (permissions: string[]) => {
    cache = createTestCache();
    await grantStaffPermissions(cache, {
      permissions: permissions.flatMap(permission => [
        {
          module: posts.definition.permissionModule,
          permission,
          plugin: PLUGIN_ID,
        },
        {
          module: notes.definition.permissionModule,
          permission,
          plugin: PLUGIN_ID,
        },
      ]),
      userId: STAFF_ID,
    });
  };

  const post = async (
    path: string,
    body?: Record<string, unknown>,
  ): Promise<Response> =>
    await app.request(path, {
      method: "POST",
      ...(body === undefined
        ? {}
        : {
            body: JSON.stringify(body),
            headers: { "Content-Type": "application/json" },
          }),
    });

  const editorial = (c = context()) => {
    const build = posts.editorialService;
    if (!build) throw new Error("posts are editorial");

    return build(c, { pluginId: PLUGIN_ID });
  };

  // Called directly rather than through `editorialVisibilityMethods`, so the
  // conditional service type is exercised: `hide` exists on this content type.
  const hideable = (c = context()) => editorial(c);

  const createPost = async (
    title: string,
    slug: string,
    { publish = true }: { publish?: boolean } = {},
  ): Promise<number> => {
    const created = await editorial().create(
      { excerpt: `About ${title}`, slug, title },
      { actor: ACTOR },
    );
    if (publish) await editorial().publish(created.row.id, { actor: ACTOR });

    return created.row.id;
  };

  const readPost = async (id: number) => {
    const [row] = await database.db
      .select()
      .from(posts.table)
      .where(eq(posts.table.id, id));

    return row;
  };

  const publicPosts = (c = context()) => {
    const build = posts.publicService;
    if (!build) throw new Error("posts have a public API");

    return build(c);
  };

  const delivery = (c = context()) => {
    const build = posts.deliveryService;
    if (!build) throw new Error("posts have delivery");

    return build(c, { pluginId: PLUGIN_ID });
  };

  const sitemapIds = async (
    model: typeof pages | typeof posts,
    locale?: string,
  ): Promise<(number | string)[]> =>
    (
      await readContentDeliverySitemapPage({
        args: locale === undefined ? {} : { locale },
        c: context(),
        model: model as typeof posts,
      })
    ).entries.map(entry => entry.itemId);

  beforeAll(async () => {
    database = await createTestDatabase({
      core_content_file_refs,
      core_content_revisions,
      core_content_schedules,
      core_content_slug_history,
      core_files,
      core_languages,
      core_roles,
      core_users,
      notes: notes.table,
      pages: pages.table,
      pagesTranslations: pages.translationTable,
      posts: posts.table,
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
  }, 60_000);

  afterAll(async () => {
    await database?.drop();
  });

  beforeEach(async () => {
    emitted = [];
    searchCalls = [];
    dispatched = [];
    fetchMock = vi.fn(async () => await Promise.resolve(new Response("ok")));
    vi.stubGlobal("fetch", fetchMock);
    await grant([CONTENT_PERMISSIONS.hide, CONTENT_PERMISSIONS.view]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("public reads", () => {
    it("takes a hidden record out of the list, the detail, the slug read and delivery, and puts it back", async () => {
      const hidden = await createPost("Hidden story", "hidden-story");
      const other = await createPost("Other story", "other-story");

      const before = await publicPosts().findMany();
      expect(before.edges.map(row => row.id)).toEqual(
        expect.arrayContaining([hidden, other]),
      );

      const { version } = await readPost(hidden);
      await hideable().hide(hidden, { actor: ACTOR, expectedVersion: version });

      const list = await publicPosts().findMany();
      expect(list.edges.map(row => row.id)).not.toContain(hidden);
      expect(list.edges.map(row => row.id)).toContain(other);
      expect(await publicPosts().findById(hidden)).toBeNull();
      expect(await publicPosts().findBySlug("hidden-story")).toBeNull();
      expect(await delivery().resolveSlug("hidden-story")).toEqual({
        type: "not_found",
      });
      expect(await delivery().findById(hidden)).toBeNull();
      expect(await sitemapIds(posts)).not.toContain(hidden);
      expect(await sitemapIds(posts)).toContain(other);

      // Still published as far as the AdminCP is concerned.
      expect(await readPost(hidden)).toMatchObject({ status: "published" });

      await hideable().unhide(hidden, { actor: ACTOR });

      expect(await publicPosts().findById(hidden)).not.toBeNull();
      expect(await delivery().resolveSlug("hidden-story")).toMatchObject({
        type: "content",
      });
      expect(await sitemapIds(posts)).toContain(hidden);
    });

    it("stops a historical URL from redirecting to a hidden record", async () => {
      const id = await createPost("Old title", "old-address");
      const current = await readPost(id);
      await editorial().update(
        id,
        { slug: "new-address" },
        { actor: ACTOR, expectedVersion: current.version },
      );

      expect(await delivery().resolveSlug("old-address")).toMatchObject({
        type: "redirect",
      });

      await hideable().hide(id, { actor: ACTOR });

      expect(await delivery().resolveSlug("old-address")).toEqual({
        type: "not_found",
      });
      expect(await delivery().resolveSlug("new-address")).toEqual({
        type: "not_found",
      });

      await hideable().unhide(id, { actor: ACTOR });

      expect(await delivery().resolveSlug("old-address")).toMatchObject({
        type: "redirect",
      });
    });

    it("answers 404 on the public HTTP routes while a signed preview still works", async () => {
      const id = await createPost("Preview me", "preview-me");
      const hidden = await hideable().hide(id, { actor: ACTOR });
      if (!hidden?.revisionId) throw new Error("expected a hide revision");

      expect((await app.request("/public/preview-me")).status).toBe(404);
      const list = (await (await app.request("/public/")).json()) as {
        edges: { id: number }[];
      };
      expect(list.edges.map(row => row.id)).not.toContain(id);

      const { token } = createContentPreviewToken({
        definition: posts.definition,
        itemId: id,
        pluginId: PLUGIN_ID,
        revisionId: hidden.revisionId,
        secret: PREVIEW_SECRET,
        version: hidden.version,
      });
      const preview = await app.request(`/public/preview/${token}`);

      expect(preview.status).toBe(200);
      expect(await preview.json()).toMatchObject({ title: "Preview me" });
    });

    it("hides a localized record in every language, the fallback included", async () => {
      const c = context();
      const localizedService = pages.localizedService?.(c, {
        pluginId: PLUGIN_ID,
      });
      const pageEditorial = pages.editorialService?.(c, {
        pluginId: PLUGIN_ID,
      });
      const translations = pages.translationEditorialService?.(c, {
        pluginId: PLUGIN_ID,
      });
      if (!localizedService || !pageEditorial || !translations) {
        throw new Error("pages are localized and editorial");
      }

      const both = await localizedService.create(
        { shared: {}, translation: { slug: "both", title: "Both" } },
        { actor: ACTOR },
      );
      await translations.create(
        both.row.id,
        "pl",
        { slug: "oba", title: "Oba" },
        { actor: ACTOR },
      );
      const englishOnly = await localizedService.create(
        { shared: {}, translation: { slug: "english-only", title: "English" } },
        { actor: ACTOR },
      );
      await pageEditorial.publish(both.row.id, { actor: ACTOR });
      await pageEditorial.publish(englishOnly.row.id, { actor: ACTOR });

      const publicPages = () => {
        const build = pages.publicService;
        if (!build) throw new Error("pages have a public API");

        return build(context());
      };

      // Served in Polish through the fallback before anything is hidden.
      expect(
        await publicPages().findById(englishOnly.row.id, { locale: "pl" }),
      ).toMatchObject({ locale: "en" });
      expect(
        await readDeliveryAlternates({
          c: context(),
          itemId: both.row.id,
          model: pages,
        }),
      ).toHaveLength(2);

      const hide = editorialVisibilityMethods(pages.definition, pageEditorial);
      const outcome = await hide.hide(both.row.id, { actor: ACTOR });
      await hide.hide(englishOnly.row.id, { actor: ACTOR });

      for (const locale of ["en", "pl"]) {
        expect(
          await publicPages().findById(both.row.id, { locale }),
        ).toBeNull();
        expect(
          await publicPages().findById(englishOnly.row.id, { locale }),
        ).toBeNull();
        expect(await sitemapIds(pages, locale)).not.toContain(both.row.id);
      }
      expect(
        await publicPages().findBySlug("oba", { fallback: true, locale: "pl" }),
      ).toBeNull();
      expect(
        (await publicPages().findMany({ locale: "pl" })).edges.map(
          row => row.id,
        ),
      ).not.toContain(both.row.id);
      expect(
        await readDeliveryAlternates({
          c: context(),
          itemId: both.row.id,
          model: pages,
        }),
      ).toEqual([]);
      expect(
        (await contentPublicLocaleStates(context(), pages, both.row.id)).map(
          state => state.isPublic,
        ),
      ).toEqual([false, false]);

      const deliverPages = pages.deliveryService?.(context(), {
        pluginId: PLUGIN_ID,
      });
      expect(await deliverPages?.resolveSlug("both", { locale: "en" })).toEqual(
        { type: "not_found" },
      );

      // Every language's document turns private, and each locale's page expires.
      if (!outcome) throw new Error("expected an outcome");
      const effects = await contentVisibilityEffects(
        context(),
        pages,
        outcome,
        {
          pluginId: PLUGIN_ID,
        },
      );
      expect(effects.searchByLocale?.map(entry => entry.action).sort()).toEqual(
        ["upsert", "upsert"],
      );
      expect(
        searchCalls
          .filter(call => call.op === "index")
          .map(call => [call.document?.languageCode, call.document?.isPublic]),
      ).toEqual(
        expect.arrayContaining([
          ["en", false],
          ["pl", false],
        ]),
      );
      const [, sent] = fetchMock.mock.calls[0] as [string, { body: string }];
      const body = JSON.parse(sent.body) as Parameters<
        typeof contentInvalidationTags
      >[0];
      expect(
        body.locales?.map(entry => [entry.locale, entry.wasPublic]),
      ).toEqual(
        expect.arrayContaining([
          ["en", true],
          ["pl", true],
        ]),
      );
      expect(contentInvalidationTags(body)).toEqual(
        expect.arrayContaining([
          contentPublicItemTag(pages.definition.id, both.row.id, "en"),
          contentPublicItemTag(pages.definition.id, both.row.id, "pl"),
        ]),
      );

      // A rebuild agrees with the live write.
      const rebuilt = await createContentLocalizedSearchIndexer(pages, {
        pluginId: PLUGIN_ID,
      }).load(context(), 0, 100);
      expect(
        rebuilt.documents
          .filter(document => document.itemId === both.row.id)
          .map(document => document.isPublic),
      ).toEqual([false, false]);

      await hide.unhide(both.row.id, { actor: ACTOR });
      expect(
        await publicPages().findById(both.row.id, { locale: "pl" }),
      ).toMatchObject({ locale: "pl" });
    });
  });

  describe("the editorial service", () => {
    it("writes one revision and one version per real change, and nothing for a repeat", async () => {
      const id = await createPost("Versioned", "versioned");
      const before = await readPost(id);

      const first = await hideable().hide(id, { actor: ACTOR });
      expect(first).toMatchObject({
        changed: true,
        operation: "hide",
        version: before.version + 1,
        visibility: {
          actorUserId: STAFF_ID,
          before: { hiddenAt: null, hiddenBy: null },
          isPublic: false,
          wasPublic: true,
        },
      });
      expect(first?.row).toMatchObject({ hiddenBy: STAFF_ID });
      expect(first?.row.hiddenAt).toBeInstanceOf(Date);

      const revision = await editorial().revisions.findById(
        id,
        first?.revisionId ?? 0,
      );
      expect(revision).toMatchObject({ operation: "hide" });
      expect(revision?.snapshot).toMatchObject({
        visibility: { hiddenBy: STAFF_ID },
      });

      const repeat = await hideable().hide(id, { actor: ACTOR });
      expect(repeat).toMatchObject({
        changed: false,
        revisionId: null,
        version: before.version + 1,
      });
      const history = await editorial().revisions.list(id);
      expect(history.edges.map(entry => entry.operation)).toEqual([
        "hide",
        "publish",
        "create",
      ]);

      const unhidden = await hideable().unhide(id, { actor: ACTOR });
      expect(unhidden).toMatchObject({
        changed: true,
        operation: "unhide",
        row: { hiddenAt: null, hiddenBy: null },
        visibility: { isPublic: true, wasPublic: false },
      });
      expect((await hideable().unhide(id, { actor: ACTOR }))?.changed).toBe(
        false,
      );
    });

    it("refuses a stale expectedVersion and leaves the record as it was", async () => {
      const id = await createPost("Contested", "contested");
      const { version } = await readPost(id);

      await expect(
        hideable().hide(id, { actor: ACTOR, expectedVersion: version - 1 }),
      ).rejects.toBeInstanceOf(ContentVersionConflict);
      expect(await readPost(id)).toMatchObject({ hiddenAt: null, version });
      expect(await hideable().hide(9_999_999, { actor: ACTOR })).toBeNull();
    });

    it("keeps the current visibility through a restore, in both directions", async () => {
      const id = await createPost("Restorable", "restorable");
      const original = await readPost(id);
      const firstRevision = (await editorial().revisions.list(id)).edges.at(-1);
      if (!firstRevision) throw new Error("expected a create revision");

      const edited = await editorial().update(
        id,
        { title: "Restorable, edited" },
        { actor: ACTOR, expectedVersion: original.version },
      );
      const hidden = await hideable().hide(id, { actor: ACTOR });

      // Restoring a version from before the hide brings its words back, not
      // its visibility.
      const restored = await editorial().restore(id, firstRevision.id, {
        actor: ACTOR,
        expectedVersion: hidden?.version ?? 0,
      });
      expect(restored?.changed).toBe(true);
      expect(restored?.row).toMatchObject({ title: "Restorable" });
      expect(restored?.row.hiddenAt).toBeInstanceOf(Date);

      const unhidden = await hideable().unhide(id, { actor: ACTOR });
      // Restoring the hide revision itself does not hide the record again.
      const again = await editorial().restore(id, hidden?.revisionId ?? 0, {
        actor: ACTOR,
        expectedVersion: unhidden?.version ?? 0,
      });
      expect(again?.row).toMatchObject({
        hiddenAt: null,
        title: edited?.row.title,
      });
      expect(await publicPosts().findById(id)).not.toBeNull();
    });

    it("never unhides on publish, and reports a hidden record as not public on both sides", async () => {
      const id = await createPost("Draft then hidden", "draft-then-hidden", {
        publish: false,
      });
      await hideable().hide(id, { actor: ACTOR });

      const published = await editorial().publish(id, { actor: ACTOR });
      expect(published?.row).toMatchObject({ status: "published" });
      expect(published?.row.hiddenAt).toBeInstanceOf(Date);
      // No sitemap line appeared, so nothing to expire, and no address reserved.
      expect(published?.delivery?.sitemap).toEqual({
        contentChanged: false,
        indexChanged: false,
      });
      expect(
        await database.db
          .select()
          .from(core_content_slug_history)
          .where(
            and(
              eq(core_content_slug_history.contentTypeId, posts.definition.id),
              eq(core_content_slug_history.itemId, String(id)),
            ),
          ),
      ).toEqual([]);
      expect(await publicPosts().findById(id)).toBeNull();

      const unpublished = await editorial().unpublish(id, { actor: ACTOR });
      expect(unpublished?.delivery?.sitemap).toEqual({
        contentChanged: false,
        indexChanged: false,
      });
      expect(unpublished?.row.hiddenAt).toBeInstanceOf(Date);
    });
  });

  describe("scheduled transitions", () => {
    const schedule = async (id: number, action: "publish" | "unpublish") => {
      const [row] = await database.db
        .insert(core_content_schedules)
        .values({
          action,
          contentTypeId: posts.definition.id,
          itemId: String(id),
          pluginId: PLUGIN_ID,
          scheduledFor: new Date(Date.now() - 60_000),
        })
        .returning({ id: core_content_schedules.id });

      return row.id;
    };

    it("publishes a hidden record without making it public, and announces nothing to the web", async () => {
      const id = await createPost("Scheduled", "scheduled", { publish: false });
      await hideable().hide(id, { actor: ACTOR });
      emitted = [];
      searchCalls = [];

      const scheduleId = await schedule(id, "publish");
      expect(
        await executeContentSchedule(context(), { generation: 1, scheduleId }),
      ).toEqual({ status: "executed" });

      expect(await readPost(id)).toMatchObject({ status: "published" });
      expect((await readPost(id)).hiddenAt).toBeInstanceOf(Date);
      expect(dispatched).toHaveLength(1);
      expect(dispatched[0].wasPublic).toBe(false);

      await runContentScheduleEffects(context(), dispatched[0]);

      expect(emitted.map(event => event.name)).toEqual([
        `content.${posts.definition.id}.published`,
      ]);
      expect(
        searchCalls.map(call => [call.op, call.document?.isPublic]),
      ).toEqual([["index", false]]);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(await publicPosts().findById(id)).toBeNull();
    });

    it("reports a scheduled unpublish of a hidden record as never having been public", async () => {
      const id = await createPost("Scheduled off", "scheduled-off");
      await hideable().hide(id, { actor: ACTOR });

      const scheduleId = await schedule(id, "unpublish");
      await executeContentSchedule(context(), { generation: 1, scheduleId });

      expect(dispatched[0]).toMatchObject({
        operation: "unpublish",
        wasPublic: false,
      });

      fetchMock.mockClear();
      await runContentScheduleEffects(context(), dispatched[0]);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("the hide and unhide routes", () => {
    it("runs every effect once, after the commit, and none for a repeat", async () => {
      const id = await createPost("Routed", "routed");
      emitted = [];
      searchCalls = [];

      const hidden = await post(`/${id}/hide`);
      expect(hidden.status).toBe(200);
      const body = (await hidden.json()) as {
        changed: boolean;
        row: Record<string, unknown>;
      };
      expect(body.changed).toBe(true);
      expect(body.row.hiddenBy).toBe(STAFF_ID);

      expect(emitted).toEqual([
        {
          name: `content.${posts.definition.id}.hidden`,
          payload: expect.objectContaining({
            actorUserId: STAFF_ID,
            contentId: id,
            hiddenAt: expect.any(Date),
          }),
        },
      ]);
      expect(searchCalls).toHaveLength(1);
      expect(searchCalls[0].document).toMatchObject({
        isPublic: false,
        itemId: id,
      });
      expect(searchCalls[0].document?.url).toBeUndefined();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, { body: string }];
      expect(url).toBe(`${WEB}${CONTENT_REVALIDATE_PATH}`);
      const request = JSON.parse(init.body) as Parameters<
        typeof contentInvalidationTags
      >[0];
      expect(request).toMatchObject({
        isPublic: false,
        mode: "immediate",
        slugs: ["routed"],
        wasPublic: true,
      });
      expect(contentInvalidationTags(request)).toContain(
        contentPublicItemTag(posts.definition.id, id),
      );

      const repeat = await post(`/${id}/hide`, {});
      expect(repeat.status).toBe(200);
      expect(((await repeat.json()) as { changed: boolean }).changed).toBe(
        false,
      );
      expect(emitted).toHaveLength(1);
      expect(searchCalls).toHaveLength(1);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const shown = await post(`/${id}/unhide`);
      expect(shown.status).toBe(200);
      expect(emitted.at(-1)?.name).toBe(
        `content.${posts.definition.id}.unhidden`,
      );
      expect(searchCalls.at(-1)?.document).toMatchObject({
        isPublic: true,
        url: "/hideable-posts/routed",
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("tells no web origin about hiding a draft, which was never public", async () => {
      const id = await createPost("Quiet draft", "quiet-draft", {
        publish: false,
      });

      expect((await post(`/${id}/hide`)).status).toBe(200);
      expect(emitted.at(-1)?.name).toBe(
        `content.${posts.definition.id}.hidden`,
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("needs can_hide, answers 409 for a stale version and 404 for a missing record", async () => {
      const id = await createPost("Guarded", "guarded");

      await grant([
        CONTENT_PERMISSIONS.view,
        CONTENT_PERMISSIONS.edit,
        CONTENT_PERMISSIONS.publish,
      ]);
      expect((await post(`/${id}/hide`)).status).toBe(403);
      expect((await post(`/${id}/unhide`)).status).toBe(403);
      expect((await readPost(id)).hiddenAt).toBeNull();

      await grant([CONTENT_PERMISSIONS.hide]);
      const { version } = await readPost(id);
      const stale = await post(`/${id}/hide`, {
        expectedVersion: version + 5,
      });
      expect(stale.status).toBe(409);
      expect(await stale.json()).toMatchObject({
        code: "CONTENT_VERSION_CONFLICT",
        currentVersion: version,
      });
      expect((await readPost(id)).hiddenAt).toBeNull();

      expect((await post("/9999999/hide")).status).toBe(404);
      expect(
        (await post(`/${id}/hide`, { expectedVersion: version })).status,
      ).toBe(200);
    });

    it("filters the admin list by visibility next to the status filter", async () => {
      const hiddenId = await createPost("Listed hidden", "listed-hidden");
      const shownId = await createPost("Listed shown", "listed-shown");
      await hideable().hide(hiddenId, { actor: ACTOR });

      const ids = async (query: string): Promise<number[]> =>
        (
          (await (await app.request(`/?first=100&${query}`)).json()) as {
            edges: { hiddenAt: null | string; id: number }[];
          }
        ).edges.map(row => row.id);

      expect(await ids("visibility=hidden")).toContain(hiddenId);
      expect(await ids("visibility=hidden")).not.toContain(shownId);
      expect(await ids("visibility=visible&status=published")).toContain(
        shownId,
      );
      expect(await ids("visibility=visible")).not.toContain(hiddenId);
      expect(await ids("status=published&visibility=hidden")).toEqual(
        expect.arrayContaining([hiddenId]),
      );
      expect((await app.request("/?visibility=secret")).status).toBe(400);
    });
  });

  describe("without editorial", () => {
    it("hides through the plain repository, idempotently, with no version in the event", async () => {
      const service = notes.service(context());
      const created = await service.create({ slug: "a-note", title: "A note" });
      await service.publish(created.id);
      // Typed off the definition: `hide` exists because `visibility` does.
      const plain = notes.service(context());

      const hidden = await plain.hide(created.id, { actorUserId: STAFF_ID });
      expect(hidden).toMatchObject({
        changed: true,
        hiddenBy: STAFF_ID,
        visibility: { isPublic: false, wasPublic: true },
      });
      expect(hidden?.hiddenAt).toBeInstanceOf(Date);
      expect((await plain.hide(created.id))?.changed).toBe(false);

      const notesPublic = notes.publicService?.(context());
      expect(await notesPublic?.findById(created.id)).toBeNull();

      const rebuilt = await createContentSearchIndexer(notes, {
        pluginId: PLUGIN_ID,
      }).load(context(), 0, 100);
      expect(
        rebuilt.documents.find(document => document.itemId === created.id)
          ?.isPublic,
      ).toBe(false);

      const shown = await post(`/notes/${created.id}/unhide`);
      expect(shown.status).toBe(200);
      expect(emitted.at(-1)).toEqual({
        name: `content.${notes.definition.id}.unhidden`,
        payload: { actorUserId: STAFF_ID, contentId: created.id },
      });
      expect(await notesPublic?.findById(created.id)).not.toBeNull();
    });
  });
});
