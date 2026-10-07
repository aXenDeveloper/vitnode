// @vitest-environment node
import type { Context, MiddlewareHandler } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { and, asc, eq, inArray } from "drizzle-orm";
import { createTranslator } from "use-intl";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PermissionsStaffArgs } from "@/api/lib/permission-staff";

import {
  core_content_file_refs,
  core_content_revisions,
  core_content_slug_history,
} from "@/database/content";
import { core_files } from "@/database/files";
import { core_languages } from "@/database/languages";
import { core_roles } from "@/database/roles";
import { core_users } from "@/database/users";
import apiMessages from "@/locales/api/en.json";
import { createTestCache } from "@/tests/cache";
import {
  testCategoryContentType,
  testContentLocaleRouting,
  testDuplicableArticleContentType,
  testDuplicableNoteContentType,
} from "@/tests/content-fixtures";
import {
  createTestDatabase,
  describePostgres,
  type TestDatabaseHandle,
} from "@/tests/postgres";
import { grantStaffPermissions } from "@/tests/staff-permissions";

import { CONTENT_PERMISSIONS } from "../const";
import { createContentModel } from "./model";
import { buildContentRoutes } from "./routes";

const PLUGIN_ID = "@vitnode/test";

const categories = createContentModel(testCategoryContentType);
const articles = createContentModel(testDuplicableArticleContentType, {
  references: { categories: () => categories.table.id },
});
const notes = createContentModel(testDuplicableNoteContentType);

const plMessages = {
  ...apiMessages,
  core: {
    ...apiMessages.core,
    content: { duplicate: { title_suffix: "(Kopia)" } },
  },
};

const adminUser = { id: 1, roleId: 1 };
const actor = { type: "staff" as const, userId: adminUser.id };

const label = (route: { method: string; path: string }): string =>
  `${route.method.toUpperCase()} ${route.path}`;

interface Harness {
  app: OpenAPIHono;
  c: Context;
  emitted: { name: string; payload: Record<string, unknown> }[];
  grant: (permissions: string[]) => Promise<void>;
  indexed: { itemId: unknown; languageCode: unknown }[];
  /** A fresh context on the same database, for a second concurrent writer. */
  makeContext: () => Context;
}

const grantsOf = (
  module: string,
  permissions: string[],
): PermissionsStaffArgs[] =>
  permissions.map(permission => ({ module, permission, plugin: PLUGIN_ID }));

const createHarness = (
  db: TestDatabaseHandle["db"] | undefined,
  { disabledLocales = [] }: { disabledLocales?: string[] } = {},
): Harness => {
  const emitted: Harness["emitted"] = [];
  const indexed: Harness["indexed"] = [];
  let cache = createTestCache();

  const vars = (): Map<string, unknown> =>
    new Map<string, unknown>([
      ["admin", { user: adminUser }],
      [
        "core",
        {
          i18n: {
            defaultLocale: "en",
            localeRouting: testContentLocaleRouting(),
            locales: [
              { code: "en" },
              { code: "pl", enabled: !disabledLocales.includes("pl") },
            ],
          },
        },
      ],
      ["db", db],
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
              createTranslator({
                locale,
                messages: locale === "pl" ? plMessages : apiMessages,
              }),
            ),
          resolveSupportedLocale: (preferred?: string) =>
            preferred === "pl" ? "pl" : "en",
        },
      ],
      ["log", { error: async () => {} }],
      [
        "search",
        {
          delete: async () => {},
          index: async (document: {
            itemId: unknown;
            languageCode: unknown;
          }) => {
            indexed.push({
              itemId: document.itemId,
              languageCode: document.languageCode,
            });
            await Promise.resolve();
          },
        },
      ],
    ]);

  const makeContext = (): Context => {
    const values = vars();
    values.set("cache", cache);

    return {
      get: (key: string) => values.get(key),
      set: (key: string, value: unknown) => values.set(key, value),
    } as unknown as Context;
  };

  const app = new OpenAPIHono();
  const middleware: MiddlewareHandler = async (c, next) => {
    for (const [key, value] of vars()) c.set(key as never, value as never);
    c.set("cache", cache);
    await next();
  };
  app.use("*", middleware);
  const mount = (
    module: string,
    routes: { handler: never; route: never }[],
  ): void => {
    const sub = new OpenAPIHono();
    for (const { handler, route } of routes) sub.openapi(route, handler);
    app.route(`/${module}`, sub);
  };
  mount(
    articles.definition.permissionModule,
    buildContentRoutes(articles, { pluginId: PLUGIN_ID }) as never,
  );
  mount(
    notes.definition.permissionModule,
    buildContentRoutes(notes, { pluginId: PLUGIN_ID }) as never,
  );

  return {
    app,
    c: makeContext(),
    emitted,
    grant: async permissions => {
      cache = createTestCache();
      await grantStaffPermissions(cache, {
        permissions: [
          ...grantsOf(articles.definition.permissionModule, permissions),
          ...grantsOf(notes.definition.permissionModule, permissions),
        ],
        userId: adminUser.id,
      });
    },
    indexed,
    makeContext,
  };
};

const post = async (
  harness: Harness,
  path: string,
  body: unknown = {},
): Promise<Response> =>
  await harness.app.request(path, {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });

describe("POST /{id}/duplicate permissions", () => {
  const harness = createHarness(undefined);
  const path = `/${articles.definition.permissionModule}/7/duplicate`;

  it.each([
    ["nothing", []],
    ["can_view alone", [CONTENT_PERMISSIONS.view]],
    ["can_create alone", [CONTENT_PERMISSIONS.create]],
  ])("refuses a staff member with %s", async (_label, permissions) => {
    await harness.grant(permissions);

    expect((await post(harness, path)).status).toBe(403);
  });

  it("documents the route with its refusals", () => {
    const document = harness.app.getOpenAPI31Document({
      info: { title: "test", version: "1" },
      openapi: "3.1.0",
    });
    const route =
      document.paths?.[
        `/${articles.definition.permissionModule}/{id}/duplicate`
      ]?.post;

    expect(Object.keys(route?.responses ?? {}).sort()).toEqual([
      "201",
      "400",
      "403",
      "404",
      "409",
      "422",
    ]);
  });

  it("is mounted only on a content type that enables duplication", () => {
    const enabled = buildContentRoutes(articles, { pluginId: PLUGIN_ID }).map(
      ({ route }) => label(route),
    );
    const disabled = buildContentRoutes(categories, {
      pluginId: PLUGIN_ID,
    }).map(({ route }) => label(route));

    expect(enabled).toContain("POST /{id}/duplicate");
    expect(disabled.some(entry => entry.includes("duplicate"))).toBe(false);
  });
});

describePostgres("duplicate (Postgres)", () => {
  let database: TestDatabaseHandle;
  let languageIds: Record<string, number>;
  let userIds: number[];
  let fileIds: number[];
  let categoryIds: number[];

  const tables = {
    articleJunctions: Object.values(articles.advancedTables.junctions),
    articleRepeatables: Object.values(articles.advancedTables.repeatables),
  };

  beforeAll(async () => {
    database = await createTestDatabase({
      categories: categories.table,
      core_content_file_refs,
      core_content_revisions,
      core_content_slug_history,
      core_files,
      core_languages,
      core_roles,
      core_users,
      duplicableArticles: articles.table,
      duplicableArticleTranslations: articles.translationTable,
      duplicableNotes: notes.table,
      ...Object.fromEntries(
        [...tables.articleJunctions, ...tables.articleRepeatables].map(
          (table, index) => [`advanced${index}`, table],
        ),
      ),
    });

    const languages = await database.db
      .insert(core_languages)
      .values([
        { code: "en", default: true, name: "English" },
        { code: "pl", name: "Polski" },
      ])
      .returning({ code: core_languages.code, id: core_languages.id });
    languageIds = Object.fromEntries(languages.map(row => [row.code, row.id]));

    await database.db.insert(core_roles).values({ id: 1 });
    userIds = (
      await database.db
        .insert(core_users)
        .values(
          [1, 2, 3].map(n => ({
            avatarColor: "000000",
            email: `user${n}@example.com`,
            id: n,
            ipAddress: "127.0.0.1",
            name: `User ${n}`,
            nameCode: `user-${n}`,
            roleId: 1,
          })),
        )
        .returning({ id: core_users.id })
    ).map(row => row.id);

    fileIds = (
      await database.db
        .insert(core_files)
        .values(
          [1, 2, 3].map(n => ({
            folder: "content",
            key: `content/file-${n}.png`,
            mimeType: "image/png",
            name: `file-${n}.png`,
            size: 100,
          })),
        )
        .returning({ id: core_files.id })
    ).map(row => row.id);

    const harness = createHarness(database.db);
    categoryIds = [];
    for (const title of ["News", "Guides", "Tips"]) {
      const row = await categories.service(harness.c).create({ title });
      categoryIds.push(row.id);
    }
  }, 60_000);

  afterAll(async () => {
    await database?.drop();
  });

  let harness: Harness;

  beforeEach(async () => {
    harness = createHarness(database.db);
    await harness.grant([CONTENT_PERMISSIONS.create, CONTENT_PERMISSIONS.view]);
  });

  let seeded = 0;

  /**
   * A published source with two languages and every collection filled. The
   * Polish title is numbered, so every source owns its own Polish slug.
   */
  const seedArticle = async ({
    code = null,
    title = "Hello",
  }: { code?: null | string; title?: string } = {}) => {
    seeded += 1;
    const plTitle = `Witaj ${seeded}`;
    const editorial = articles.editorialService?.(harness.c, {
      pluginId: PLUGIN_ID,
    });
    const translations = articles.translationEditorialService?.(harness.c, {
      pluginId: PLUGIN_ID,
    });
    if (!editorial || !translations) throw new Error("Editorial expected.");

    const created = await editorial.create(
      {
        author: userIds[0],
        categories: [categoryIds[2], categoryIds[0]],
        code,
        cover: fileIds[0],
        faq: [
          { answer: "Yes.", question: "First?" },
          { answer: "No.", question: "Second?" },
        ],
        featured: true,
        gallery: [fileIds[2], fileIds[1]],
        reviewers: [userIds[2], userIds[1]],
        startsAt: "2026-01-02T03:04:05.000Z",
      },
      { actor },
    );
    const id = created.row.id;

    await translations.create(
      id,
      "en",
      { seo: { description: "About hello" }, title },
      { actor },
    );
    await translations.create(id, "pl", { title: plTitle }, { actor });
    await editorial.publish(id, { actor });

    return { id, plSlug: `witaj-${seeded}` };
  };

  const sourceShape = async (id: number) => {
    const service = articles.service(harness.c);
    const row = await service.findDetail(id);
    const localized = await articles
      .translationService?.(harness.c)
      .findManyRowsForItem(id);

    return { localized: localized ?? [], row };
  };

  const revisionsOf = async (itemId: number) =>
    await database.db
      .select({
        languageId: core_content_revisions.languageId,
        operation: core_content_revisions.operation,
        version: core_content_revisions.version,
      })
      .from(core_content_revisions)
      .where(
        and(
          eq(
            core_content_revisions.contentTypeId,
            testDuplicableArticleContentType.id,
          ),
          eq(core_content_revisions.itemId, itemId),
        ),
      )
      .orderBy(asc(core_content_revisions.id));

  const countRows = async () => ({
    articles: (await database.db.select().from(articles.table)).length,
    children: (
      await Promise.all(
        tables.articleRepeatables.map(
          async table => await database.db.select().from(table),
        ),
      )
    ).flat().length,
    junctions: (
      await Promise.all(
        tables.articleJunctions.map(
          async table => await database.db.select().from(table),
        ),
      )
    ).flat().length,
    revisions: (await database.db.select().from(core_content_revisions)).length,
    translations: articles.translationTable
      ? (await database.db.select().from(articles.translationTable)).length
      : 0,
  });

  it("copies a localized editorial record as a draft in every language", async () => {
    const { id: sourceId, plSlug } = await seedArticle();
    const before = await sourceShape(sourceId);
    const filesBefore = (await database.db.select().from(core_files)).length;

    const res = await post(
      harness,
      `/${articles.definition.permissionModule}/${sourceId}/duplicate`,
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      id: number;
      locales: string[];
      row: Record<string, unknown>;
      skippedLocales: string[];
      sourceId: number;
    };

    expect(body.sourceId).toBe(sourceId);
    expect(body.id).not.toBe(sourceId);
    expect(body.locales).toEqual(["en", "pl"]);
    expect(body.skippedLocales).toEqual([]);
    expect(body.row).toMatchObject({
      publishedAt: null,
      status: "draft",
      version: 1,
    });

    const copy = await sourceShape(body.id);
    expect(copy.row).toMatchObject({
      author: userIds[0],
      // Relation, user and file order survives, and the files are the same rows:
      // a copy reuses the stored objects rather than duplicating them.
      categories: [categoryIds[2], categoryIds[0]],
      code: null,
      cover: fileIds[0],
      featured: true,
      gallery: [fileIds[2], fileIds[1]],
      reviewers: [userIds[2], userIds[1]],
      startsAt: new Date("2026-01-02T03:04:05.000Z"),
    });
    expect((await database.db.select().from(core_files)).length).toBe(
      filesBefore,
    );

    // Same children in the same order, but new rows that belong to the copy.
    const sourceFaq = before.row?.faq as { id: number; question: string }[];
    const copyFaq = copy.row?.faq as { id: number; question: string }[];
    expect(copyFaq.map(entry => entry.question)).toEqual(["First?", "Second?"]);
    expect(
      copyFaq.some(entry => sourceFaq.map(row => row.id).includes(entry.id)),
    ).toBe(false);

    expect(
      copy.localized.map(row => ({
        locale: row.locale,
        status: (row as { status?: string }).status,
        values: row.values,
        version: row.version,
      })),
    ).toEqual([
      {
        locale: "en",
        status: "draft",
        values: {
          seo: { description: "About hello" },
          slug: "hello-copy",
          title: "Hello (Copy)",
        },
        version: 1,
      },
      {
        locale: "pl",
        status: "draft",
        values: {
          seo: null,
          slug: `${plSlug}-kopia`,
          title: `Witaj ${plSlug.slice("witaj-".length)} (Kopia)`,
        },
        version: 1,
      },
    ]);

    // Each half starts its own history at a `create`.
    expect(await revisionsOf(body.id)).toEqual([
      { languageId: null, operation: "create", version: 1 },
      { languageId: languageIds.en, operation: "create", version: 1 },
      { languageId: languageIds.pl, operation: "create", version: 1 },
    ]);

    // The source is exactly as it was.
    expect(await sourceShape(sourceId)).toEqual(before);
  });

  it("runs every effect exactly once, after the commit", async () => {
    const { id: sourceId } = await seedArticle({ title: "Effects" });
    harness.emitted.length = 0;
    harness.indexed.length = 0;

    const res = await post(
      harness,
      `/${articles.definition.permissionModule}/${sourceId}/duplicate`,
    );
    const { id } = (await res.json()) as { id: number };

    const type = testDuplicableArticleContentType.id;
    expect(harness.emitted.map(entry => entry.name)).toEqual([
      `content.${type}.created`,
      `content.${type}.translation_created`,
      `content.${type}.translation_created`,
      `content.${type}.duplicated`,
    ]);
    expect(harness.emitted[0].payload).toMatchObject({
      contentId: id,
      duplicatedFromId: sourceId,
      version: 1,
    });
    expect(harness.emitted[3].payload).toEqual({
      actorUserId: adminUser.id,
      contentId: id,
      contentTypeId: type,
      sourceId,
    });
    // One document per language, written once.
    expect(harness.indexed).toEqual([
      { itemId: id, languageCode: "en" },
      { itemId: id, languageCode: "pl" },
    ]);
  });

  it("gives every further copy the next free slug", async () => {
    const { id: sourceId, plSlug } = await seedArticle({ title: "Again" });
    const path = `/${articles.definition.permissionModule}/${sourceId}/duplicate`;

    const first = (await (await post(harness, path)).json()) as { id: number };
    const second = (await (await post(harness, path)).json()) as {
      id: number;
    };

    const slugs = async (id: number) =>
      (
        (await articles
          .translationService?.(harness.c)
          .findManyRowsForItem(id)) ?? []
      ).map(row => (row.values as { slug: string }).slug);

    expect(await slugs(first.id)).toEqual(["again-copy", `${plSlug}-kopia`]);
    expect(await slugs(second.id)).toEqual([
      "again-copy-2",
      `${plSlug}-kopia-2`,
    ]);
  });

  it("skips a slug another record's redirect history still owns", async () => {
    const { id: sourceId } = await seedArticle({ title: "Moved" });
    await database.db.insert(core_content_slug_history).values({
      contentTypeId: testDuplicableArticleContentType.id,
      itemId: 999_999,
      languageId: languageIds.en,
      path: "/duplicable-articles/moved-copy",
      pluginId: PLUGIN_ID,
      slug: "moved-copy",
    });

    const res = await post(
      harness,
      `/${articles.definition.permissionModule}/${sourceId}/duplicate`,
    );
    const { id } = (await res.json()) as { id: number };
    const [en] =
      (await articles
        .translationService?.(harness.c)
        .findManyRowsForItem(id)) ?? [];

    expect((en.values as { slug: string }).slug).toBe("moved-copy-2");
  });

  it("trims a long title so the suffix still fits", async () => {
    const { id: sourceId } = await seedArticle({
      title: "Twenty characters!!!",
    });

    const res = await post(
      harness,
      `/${articles.definition.permissionModule}/${sourceId}/duplicate`,
    );
    const { id } = (await res.json()) as { id: number };
    const [en] =
      (await articles
        .translationService?.(harness.c)
        .findManyRowsForItem(id)) ?? [];

    expect((en.values as { title: string }).title).toBe("Twenty charac (Copy)");
  });

  it("applies shared and per-locale overrides instead of the copied values", async () => {
    const { id: sourceId } = await seedArticle({ title: "Override" });

    const res = await post(
      harness,
      `/${articles.definition.permissionModule}/${sourceId}/duplicate`,
      {
        overrides: { categories: [categoryIds[1]], featured: false },
        translations: { pl: { title: "Nowy" } },
      },
    );
    const { id } = (await res.json()) as { id: number };
    const copy = await sourceShape(id);

    expect(copy.row).toMatchObject({
      categories: [categoryIds[1]],
      featured: false,
    });
    expect(copy.localized.map(row => row.values)).toMatchObject([
      { slug: "override-copy", title: "Override (Copy)" },
      // An overridden title is the editor's own: no suffix, and the slug follows it.
      { slug: "nowy", title: "Nowy" },
    ]);
  });

  it("asks for a new value for a unique field the source holds", async () => {
    const { id: sourceId } = await seedArticle({
      code: "SPRING-1",
      title: "Unique",
    });
    const before = await countRows();

    const refused = await post(
      harness,
      `/${articles.definition.permissionModule}/${sourceId}/duplicate`,
    );
    expect(refused.status).toBe(422);
    expect(await refused.json()).toEqual({
      code: "CONTENT_DUPLICATE_UNIQUE_REQUIRED",
      contentTypeId: testDuplicableArticleContentType.id,
      fields: ["code"],
    });
    expect(await countRows()).toEqual(before);

    const accepted = await post(
      harness,
      `/${articles.definition.permissionModule}/${sourceId}/duplicate`,
      { overrides: { code: "SPRING-2" } },
    );
    expect(accepted.status).toBe(201);
  });

  it("rolls everything back when a later language fails", async () => {
    const { id: sourceId } = await seedArticle({ title: "Atomic" });
    const before = await countRows();

    // Straight to the service, past the route's validation, so the failure lands
    // after the base row, its collections and the English copy were written.
    await expect(
      articles
        .editorialService?.(harness.c, { pluginId: PLUGIN_ID })
        .duplicate(sourceId, {
          actor,
          translations: { pl: { title: "x".repeat(30) } },
        }),
    ).rejects.toThrow();

    expect(await countRows()).toEqual(before);
  });

  it("leaves a switched-off language behind and says so", async () => {
    const { id: sourceId } = await seedArticle({ title: "Partial" });
    const off = createHarness(database.db, { disabledLocales: ["pl"] });

    const outcome = await articles
      .editorialService?.(off.c, { pluginId: PLUGIN_ID })
      .duplicate(sourceId, { actor });

    expect(outcome?.skippedLocales).toEqual(["pl"]);
    expect(outcome?.translations.map(entry => entry.locale)).toEqual(["en"]);
  });

  it("answers 404 for a source that does not exist", async () => {
    const res = await post(
      harness,
      `/${articles.definition.permissionModule}/987654/duplicate`,
    );

    expect(res.status).toBe(404);
  });

  describe("a plain content type", () => {
    const seedNote = async (title: string, code: string, slug?: string) =>
      await notes
        .service(harness.c)
        .create({ code, title, ...(slug ? { slug } : {}) });

    it("copies through the plain service and requires the unique override", async () => {
      const source = await seedNote("First note", "N-1");
      const path = `/${notes.definition.permissionModule}/${source.id}/duplicate`;

      const refused = await post(harness, path);
      expect(refused.status).toBe(422);

      harness.emitted.length = 0;
      const res = await post(harness, path, { overrides: { code: "N-2" } });
      expect(res.status).toBe(201);
      const body = (await res.json()) as {
        id: number;
        row: Record<string, unknown>;
      };

      expect(body.row).toMatchObject({
        code: "N-2",
        slug: "first-note-copy",
        status: "draft",
        title: "First note (Copy)",
      });
      expect(harness.emitted.map(entry => entry.name)).toEqual([
        `content.${testDuplicableNoteContentType.id}.created`,
        `content.${testDuplicableNoteContentType.id}.duplicated`,
      ]);
      expect(harness.emitted[0].payload).toEqual({
        contentId: body.id,
        duplicatedFromId: source.id,
      });
    });

    it("answers a clear 409 when every slug candidate is taken", async () => {
      const source = await seedNote("Crowded", "C-0");
      for (let n = 1; n <= 20; n += 1) {
        await seedNote(
          `Crowded ${n}`,
          `C-${n}`,
          n === 1 ? "crowded-copy" : `crowded-copy-${n}`,
        );
      }

      const res = await post(
        harness,
        `/${notes.definition.permissionModule}/${source.id}/duplicate`,
        { overrides: { code: "C-copy" } },
      );

      expect(res.status).toBe(409);
      expect(await res.json()).toMatchObject({
        code: "CONTENT_DUPLICATE_SLUG_CONFLICT",
        field: "slug",
        locale: null,
      });
    });

    it("moves to the next slug when a concurrent copy commits the same one first", async () => {
      const source = await seedNote("Race", "R-0");
      const service = (c: Context) => notes.service(c);

      let wrote!: () => void;
      const firstWrote = new Promise<void>(resolve => (wrote = resolve));
      let release!: () => void;
      const gate = new Promise<void>(resolve => (release = resolve));

      // The first copy writes `race-copy` and holds its transaction open, so the
      // second one cannot see that row when it picks a slug - only the unique
      // index can tell it, after the first commits.
      const first = database.db.transaction(async tx => {
        const result = await service(harness.makeContext()).duplicate(
          source.id,
          { overrides: { code: "R-1" }, tx },
        );
        wrote();
        await gate;

        return result;
      });
      await firstWrote;

      const second = service(harness.makeContext()).duplicate(source.id, {
        overrides: { code: "R-2" },
      });
      await new Promise(resolve => setTimeout(resolve, 300));
      release();

      const [one, two] = await Promise.all([first, second]);

      expect(one?.row.slug).toBe("race-copy");
      expect(two?.row.slug).toBe("race-copy-2");
      expect(
        (
          await database.db
            .select({ id: notes.table.id })
            .from(notes.table)
            .where(inArray(notes.table.slug, ["race-copy", "race-copy-2"]))
        ).length,
      ).toBe(2);
    });
  });
});
