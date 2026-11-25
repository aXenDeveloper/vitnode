import type { Context } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { EnvVitNode } from "@/middlewares/global.middleware";
import type { PostgresTestSchema } from "@/tests/postgres";

import { defineContentContainer } from "@/content/containers/define";
import { defineContentType } from "@/content/define";
import { field } from "@/content/fields";
import { core_content_access_rules } from "@/database/content-access";
import { core_content_containers } from "@/database/content-containers";
import { core_languages } from "@/database/languages";
import { core_reactions, core_reactions_entries } from "@/database/reactions";
import { core_roles } from "@/database/roles";
import { core_users } from "@/database/users";
import {
  defineReactionTarget,
  validateReactionsRegistry,
} from "@/lib/reactions/targets";
import { SearchModel } from "@/models/search";
import { profileRoute } from "@/modules/users/routes/profile.route";
import { userTimelineRoute } from "@/modules/users/routes/timeline.route";
import { createTestCache } from "@/tests/cache";
import { testContentLocaleRouting } from "@/tests/content-fixtures";
import { createPostgresTestSchema, POSTGRES_TEST_URL } from "@/tests/postgres";

import type {
  ContentProfileCard,
  ContentProfileCursorKey,
} from "./profile-content";

import { createContentModel } from "./model";
import { countContentProfile, readContentProfilePage } from "./profile-content";

const PLUGIN_ID = "@vitnode/ptest";

/** A flat access scope, like a Blog category. */
const categoryType = defineContentType({
  id: "ptest.category",
  tableName: "ptest_categories",
  access: { scope: true },
  fields: { name: field.text({ required: true, maxLength: 100 }) },
});

/** Shaped like `blog.post`: localized, several authors, scoped by categories. */
const articleType = defineContentType({
  id: "ptest.article",
  tableName: "ptest_articles",
  localization: { defaultLocale: "en", fallback: "default" },
  publication: true,
  visibility: true,
  access: { from: "categoryId" },
  profileContent: true,
  fields: {
    categoryId: field.relation({
      min: 1,
      multiple: true,
      onDelete: "restrict",
      target: () => categoryType,
    }),
    authorId: field.user({ min: 1, multiple: true, ordered: true }),
    title: field.text({ localized: true, required: true, maxLength: 255 }),
    friendlyUrl: field.slug({
      localized: true,
      maxLength: 255,
      source: "title",
    }),
    content: field.richText({ localized: true, required: true }),
  },
  publicApi: {
    path: "ptest-articles",
    fields: ["id", "title", "friendlyUrl", "content", "publishedAt"],
  },
  search: {
    titleField: "title",
    contentFields: ["title", "content"],
    pathTemplate: "/articles/{slug}",
    authorField: "authorId",
  },
});

/** Shaped like `forum.forums`: nested, with access rules and policies. */
const forumContainers = defineContentContainer({
  id: "ptest.forums",
  hierarchy: { maxDepth: 4 },
  access: true,
  policies: {
    defaults: {
      publish: "immediate",
      edits: "immediate",
      authorEdit: "always",
    },
  },
  publicApi: { path: "ptest-forums" },
});

/** Shaped like `forum.topic`. */
const topicType = defineContentType({
  id: "ptest.topic",
  tableName: "ptest_topics",
  publication: true,
  visibility: true,
  profileContent: { label: "content.topic.profile_label" },
  fields: {
    title: field.text({ required: true, maxLength: 200 }),
    slug: field.slug({ source: "title" }),
    body: field.richText({ required: true }),
    author: field.user(),
    forum: field.container({ definition: forumContainers, required: true }),
  },
  publicApi: {
    path: "ptest-topics",
    fields: ["id", "title", "slug", "body", "forum", "publishedAt"],
  },
  publicWrite: {
    ownership: { field: "author" },
    create: { fields: ["title", "body", "forum"], status: "published" },
  },
  search: {
    titleField: "title",
    contentFields: ["body"],
    authorField: "author",
    pathTemplate: "/forum/topics/{slug}",
    context: { field: "forum", pathTemplate: "/forum/{slug}" },
  },
});

/** Shaped like `forum.comment`: threaded under a topic, credited by ownership. */
const commentType = defineContentType({
  id: "ptest.comment",
  tableName: "ptest_comments",
  publication: true,
  visibility: true,
  profileContent: { label: "content.comment.profile_label" },
  fields: {
    slug: field.slug({ generated: true }),
    body: field.richText({ required: true }),
    author: field.user(),
    topic: field.relation({
      target: () => topicType,
      required: true,
      container: true,
      onDelete: "cascade",
    }),
    parent: field.relation({
      self: true,
      nullable: true,
      onDelete: "set null",
    }),
  },
  publicApi: {
    path: "ptest-comments",
    fields: ["id", "slug", "body", "topic", "parent", "publishedAt"],
  },
  publicWrite: {
    ownership: { field: "author" },
    create: { fields: ["body", "topic", "parent"], status: "published" },
  },
  search: {
    titleField: "topic",
    contentFields: ["body"],
    pathTemplate: "/forum/comments/{slug}",
  },
  thread: { parent: "parent", root: "topic", maxDepth: 6 },
});

/** Published and authored, but never opted into profiles. */
const noteType = defineContentType({
  id: "ptest.note",
  tableName: "ptest_notes",
  publication: true,
  fields: {
    title: field.text({ required: true, maxLength: 200 }),
    author: field.user(),
  },
});

const categories = createContentModel(categoryType);
const articles = createContentModel(articleType, {
  references: { categoryId: () => categories.table.id },
});
const topics = createContentModel(topicType);
const comments = createContentModel(commentType, {
  references: { topic: () => topics.table.id },
});
const notes = createContentModel(noteType);

const articleTranslations = articles.translationTable;
const articleAuthors = articles.advancedTables.junctions.authorId;
const articleCategories = articles.advancedTables.junctions.categoryId;
if (!articleTranslations || !articleAuthors || !articleCategories) {
  throw new Error("the article fixture lost its generated tables");
}

const ARTICLE = "ptest.article";
const COMMENT = "ptest.comment";
const TOPIC = "ptest.topic";

const ROLE = { MEMBER: 3, ROOT: 1 } as const;
const USER = { ALICE: 1, BOB: 2, CAROL: 4, MEMBER: 3, ROOT: 9 } as const;
const NAME: Record<number, string> = {
  [USER.ALICE]: "alice",
  [USER.BOB]: "bob",
  [USER.CAROL]: "carol",
  [USER.MEMBER]: "member",
  [USER.ROOT]: "root",
};
const LANG = { EN: 1, PL: 2 } as const;
const CATEGORY = { MEMBERS: 2, OPEN: 1 } as const;
const FORUM = { OPEN: 1, PRIVATE: 2, PRIVATE_CHILD: 3 } as const;

const T0 = Date.UTC(2026, 0, 1);
const at = (minute: number) => new Date(T0 + minute * 60_000);
const FUTURE = new Date(Date.now() + 365 * 24 * 60 * 60_000);

const doc = (text: string) => ({
  content: [{ content: [{ text, type: "text" }], type: "paragraph" }],
  type: "doc",
});

const reactionTarget = defineReactionTarget({
  type: "ptest.thing",
  parseId: value => value,
  access: async (_c, { ids }) =>
    await Promise.resolve(
      new Map(ids.map(id => [id, { authorId: null, canRead: true }])),
    ),
  preview: async (_c, { ids }) =>
    await Promise.resolve(
      new Map(
        ids.map(id => [
          id,
          { label: "ptest.thing", title: `Thing ${id}`, url: `/things/${id}` },
        ]),
      ),
    ),
});

/** Activity mode reads search hits from a provider; this one has none. */
const emptySearchProvider = {
  search: async () =>
    await Promise.resolve({
      edges: [],
      pageInfo: {
        count: 0,
        endCursor: null,
        hasNextPage: false,
        hasPreviousPage: false,
        startCursor: null,
        totalCount: 0,
      },
    }),
};

const registryOf = (models: { model: unknown }[]) => ({
  contentContainers: [{ definition: forumContainers, pluginId: PLUGIN_ID }],
  contentModels: models.map(({ model }) => ({ model, pluginId: PLUGIN_ID })),
  contentTypes: models.map(({ model }) => ({
    definition: (model as { definition: unknown }).definition,
    pluginId: PLUGIN_ID,
  })),
  i18n: { localeRouting: testContentLocaleRouting() },
  ogImage: { enabled: false },
  personalInformationFields: {},
  privacy: { deletionGraceDays: 30 },
  reactions: validateReactionsRegistry([
    { definition: reactionTarget, pluginId: PLUGIN_ID },
  ]),
  search: { adapter: emptySearchProvider },
  storage: { adapter: undefined },
});

const fullCore = registryOf(
  [categories, articles, topics, comments, notes].map(model => ({ model })),
);
/** The same app without the comment plugin installed. */
const coreWithoutComments = registryOf(
  [categories, articles, topics, notes].map(model => ({ model })),
);

type Registry = typeof fullCore;

const CONTENT_TABLES =
  "ptest_comments, ptest_topics, ptest_articles_author_id, ptest_articles_category_id, ptest_articles_translations, ptest_articles, ptest_notes, core_reactions_entries";

describe.skipIf(!POSTGRES_TEST_URL)(
  "member profile content on PostgreSQL",
  () => {
    let schema: PostgresTestSchema;
    const cache = createTestCache();

    const setValues = (
      c: Context<EnvVitNode>,
      userId: null | number,
      core: Registry,
    ) => {
      c.set("db", schema.db as never);
      c.set("core", core as never);
      c.set("cache", cache);
      c.set("search", new SearchModel(c));
      c.set(
        "user",
        userId === null
          ? null
          : ({
              id: userId,
              roleId: userId === USER.ROOT ? ROLE.ROOT : ROLE.MEMBER,
            } as never),
      );
    };

    /** A real Hono context, as the routes hand one to the query. */
    const contextAs = async (
      userId: null | number = null,
      core: Registry = fullCore,
    ): Promise<Context> => {
      let captured: Context | undefined;
      const app = new Hono<EnvVitNode>();
      app.get("/", c => {
        setValues(c, userId, core);
        captured = c;

        return c.body(null, 204);
      });
      await app.request("/");
      if (!captured) throw new Error("no context");

      return captured;
    };

    const count = async (userId: number, core?: Registry) =>
      await countContentProfile(await contextAs(null, core), { userId });

    const page = async (
      userId: number,
      options: {
        after?: ContentProfileCursorKey;
        core?: Registry;
        first?: number;
        locale?: string;
        type?: string;
        viewer?: null | number;
      } = {},
    ) =>
      await readContentProfilePage(
        await contextAs(options.viewer ?? null, options.core),
        {
          after: options.after,
          first: options.first ?? 50,
          locale: options.locale,
          type: options.type,
          userId,
        },
      );

    const entries = (cards: ContentProfileCard[]) =>
      cards.map(card => `${card.itemType}:${String(card.itemId)}`);

    /** Every page of a member's list, walked `first` at a time. */
    const walk = async (
      userId: number,
      { first, type }: { first: number; type?: string },
    ) => {
      const seen: string[] = [];
      let after: ContentProfileCursorKey | undefined;
      for (let round = 0; round < 100; round++) {
        const result = await page(userId, { after, first, type });
        seen.push(...entries(result.cards));
        if (!result.hasNextPage) {
          expect(result.endCursor).toBeNull();

          return seen;
        }
        expect(result.cards).toHaveLength(first);
        expect(result.endCursor).not.toBeNull();
        after = result.endCursor ?? undefined;
      }
      throw new Error("the list never ended");
    };

    const insertArticle = async ({
      authors,
      categoryIds = [CATEGORY.OPEN],
      hiddenAt = null,
      id,
      minute,
      publishedAt = at(minute),
      status = "published",
      translations = { en: "published" },
    }: {
      authors: number[];
      categoryIds?: number[];
      hiddenAt?: Date | null;
      id: number;
      minute: number;
      publishedAt?: Date;
      status?: string;
      translations?: Partial<Record<"en" | "pl", "draft" | "published">>;
    }) => {
      await schema.db.insert(articles.table).values({
        createdAt: at(minute),
        hiddenAt,
        id,
        publishedAt,
        status,
        updatedAt: at(minute),
      } as never);
      await schema.db.insert(articleTranslations).values(
        Object.entries(translations).map(([code, state]) => ({
          content: doc(`Article ${id} body`),
          friendlyUrl: `article-${id}-${code}`,
          itemId: id,
          languageId: code === "pl" ? LANG.PL : LANG.EN,
          publishedAt: state === "published" ? publishedAt : null,
          status: state,
          title: `Article ${id} ${code.toUpperCase()}`,
        })) as never,
      );
      await schema.db.insert(articleAuthors).values(
        authors.map((relatedItemId, position) => ({
          itemId: id,
          position,
          relatedItemId,
        })) as never,
      );
      await schema.db.insert(articleCategories).values(
        categoryIds.map((relatedItemId, position) => ({
          itemId: id,
          position,
          relatedItemId,
        })) as never,
      );
    };

    const insertTopic = async ({
      author,
      forum = FORUM.OPEN,
      hiddenAt = null,
      id,
      minute,
      publishedAt = at(minute),
      status = "published",
    }: {
      author: number;
      forum?: number;
      hiddenAt?: Date | null;
      id: number;
      minute: number;
      publishedAt?: Date;
      status?: string;
    }) => {
      await schema.db.insert(topics.table).values({
        author,
        body: doc(`Topic ${id} body`),
        createdAt: at(minute),
        forum,
        hiddenAt,
        id,
        publishedAt,
        slug: `topic-${id}`,
        status,
        title: `Topic ${id}`,
        updatedAt: at(minute),
      } as never);
    };

    const insertComment = async ({
      author,
      deletedAt = null,
      hiddenAt = null,
      id,
      minute,
      status = "published",
      topic,
    }: {
      author: number;
      deletedAt?: Date | null;
      hiddenAt?: Date | null;
      id: number;
      minute: number;
      status?: string;
      topic: number;
    }) => {
      await schema.db.insert(comments.table).values({
        author,
        body: doc(`Comment ${id} body`),
        createdAt: at(minute),
        deletedAt,
        hiddenAt,
        id,
        parent: null,
        publishedAt: at(minute),
        slug: `comment-${id}`,
        status,
        topic,
        updatedAt: at(minute),
      } as never);
    };

    /**
     * What every test starts from. Alice is credited for two articles (one
     * shared with Bob, one only published in Polish), a topic and two
     * comments; everything else she wrote is a draft, scheduled, hidden,
     * deleted, restricted or under a parent a guest cannot see.
     */
    const ART = {
      SHARED: 1,
      POLISH: 2,
      DRAFT: 3,
      SCHEDULED: 4,
      HIDDEN: 5,
      RESTRICTED: 6,
      UNTRANSLATED: 7,
    } as const;
    const TOP = {
      OPEN: 1,
      BOB: 2,
      HIDDEN: 3,
      PRIVATE: 4,
      INHERITED: 5,
      DRAFT: 6,
    } as const;
    const COM = {
      ON_BOB: 1,
      ON_OWN: 2,
      DELETED: 3,
      UNDER_HIDDEN: 4,
      UNDER_DRAFT: 5,
      UNDER_PRIVATE: 6,
      BOB: 7,
      HIDDEN: 8,
    } as const;

    const seed = async () => {
      await insertArticle({
        authors: [USER.ALICE, USER.BOB],
        id: ART.SHARED,
        minute: 10,
        translations: { en: "published", pl: "published" },
      });
      await insertArticle({
        authors: [USER.ALICE],
        id: ART.POLISH,
        minute: 11,
        translations: { en: "draft", pl: "published" },
      });
      await insertArticle({
        authors: [USER.ALICE],
        id: ART.DRAFT,
        minute: 40,
        status: "draft",
      });
      await insertArticle({
        authors: [USER.ALICE],
        id: ART.SCHEDULED,
        minute: 41,
        publishedAt: FUTURE,
      });
      await insertArticle({
        authors: [USER.ALICE],
        hiddenAt: at(50),
        id: ART.HIDDEN,
        minute: 42,
      });
      await insertArticle({
        authors: [USER.ALICE],
        categoryIds: [CATEGORY.OPEN, CATEGORY.MEMBERS],
        id: ART.RESTRICTED,
        minute: 43,
      });
      await insertArticle({
        authors: [USER.ALICE],
        id: ART.UNTRANSLATED,
        minute: 44,
        translations: { en: "draft", pl: "draft" },
      });

      await insertTopic({ author: USER.ALICE, id: TOP.OPEN, minute: 20 });
      await insertTopic({ author: USER.BOB, id: TOP.BOB, minute: 21 });
      await insertTopic({
        author: USER.ALICE,
        hiddenAt: at(50),
        id: TOP.HIDDEN,
        minute: 45,
      });
      await insertTopic({
        author: USER.ALICE,
        forum: FORUM.PRIVATE,
        id: TOP.PRIVATE,
        minute: 46,
      });
      await insertTopic({
        author: USER.ALICE,
        forum: FORUM.PRIVATE_CHILD,
        id: TOP.INHERITED,
        minute: 47,
      });
      await insertTopic({
        author: USER.ALICE,
        id: TOP.DRAFT,
        minute: 48,
        status: "draft",
      });

      await insertComment({
        author: USER.ALICE,
        id: COM.ON_BOB,
        minute: 30,
        topic: TOP.BOB,
      });
      await insertComment({
        author: USER.ALICE,
        id: COM.ON_OWN,
        minute: 31,
        topic: TOP.OPEN,
      });
      await insertComment({
        author: USER.ALICE,
        deletedAt: at(50),
        id: COM.DELETED,
        minute: 49,
        topic: TOP.BOB,
      });
      await insertComment({
        author: USER.ALICE,
        id: COM.UNDER_HIDDEN,
        minute: 51,
        topic: TOP.HIDDEN,
      });
      await insertComment({
        author: USER.ALICE,
        id: COM.UNDER_DRAFT,
        minute: 52,
        topic: TOP.DRAFT,
      });
      await insertComment({
        author: USER.ALICE,
        id: COM.UNDER_PRIVATE,
        minute: 53,
        topic: TOP.PRIVATE,
      });
      await insertComment({
        author: USER.BOB,
        id: COM.BOB,
        minute: 32,
        topic: TOP.OPEN,
      });
      await insertComment({
        author: USER.ALICE,
        hiddenAt: at(50),
        id: COM.HIDDEN,
        minute: 54,
        topic: TOP.OPEN,
      });

      await schema.db.insert(notes.table).values({
        author: USER.ALICE,
        id: 1,
        publishedAt: at(60),
        status: "published",
        title: "A note",
      } as never);
    };

    const ALICE_ENTRIES = [
      `${COMMENT}:${COM.ON_OWN}`,
      `${COMMENT}:${COM.ON_BOB}`,
      `${TOPIC}:${TOP.OPEN}`,
      `${ARTICLE}:${ART.POLISH}`,
      `${ARTICLE}:${ART.SHARED}`,
    ];
    const ALICE_STATS = {
      byType: { [ARTICLE]: 2, [COMMENT]: 2, [TOPIC]: 1 },
      total: 5,
    };

    /** The real profile and timeline routes, mounted as the users module does. */
    const app = new OpenAPIHono<EnvVitNode>();
    app.use("*", async (c, next) => {
      const viewer = c.req.header("x-user");
      setValues(
        c as Context<EnvVitNode>,
        viewer ? Number(viewer) : null,
        fullCore,
      );
      await next();
    });
    const users = new OpenAPIHono<EnvVitNode>();
    users.openapi(profileRoute.route, profileRoute.handler as never);
    users.openapi(userTimelineRoute.route, userTimelineRoute.handler as never);
    app.route("/users", users);

    interface TimelineBody {
      edges: {
        item?: { itemId: number | string; itemType: string };
        kind: string;
      }[];
      pageInfo: { endCursor: null | string; hasNextPage: boolean };
    }

    const timeline = async (userId: number, query = "") => {
      const response = await app.request(`/users/${userId}/timeline${query}`);

      return {
        body: (await response.json()) as TimelineBody,
        status: response.status,
      };
    };

    beforeAll(async () => {
      schema = await createPostgresTestSchema({
        prefix: "vitnode_profile_content",
        tables: {
          ptest_articles: articles.table,
          ptest_articles_author_id: articleAuthors,
          ptest_articles_category_id: articleCategories,
          ptest_articles_translations: articleTranslations,
          ptest_categories: categories.table,
          ptest_comments: comments.table,
          ptest_notes: notes.table,
          ptest_topics: topics.table,
        },
      });
      await schema.db.insert(core_languages).values([
        { code: "en", default: true, id: LANG.EN, name: "English" },
        { code: "pl", id: LANG.PL, name: "Polski" },
      ]);
      await schema.db.insert(core_roles).values([
        { id: ROLE.ROOT, root: true, updatedAt: new Date() },
        { id: ROLE.MEMBER, updatedAt: new Date() },
      ]);
      await schema.db.insert(core_users).values(
        Object.values(USER).map(id => ({
          avatarColor: "000000",
          email: `${NAME[id]}@example.com`,
          id,
          ipAddress: "127.0.0.1",
          name: NAME[id],
          nameCode: NAME[id],
          roleId: id === USER.ROOT ? ROLE.ROOT : ROLE.MEMBER,
        })),
      );
      await schema.db.insert(categories.table).values([
        { id: CATEGORY.OPEN, name: "Open" },
        { id: CATEGORY.MEMBERS, name: "Members" },
      ] as never);
      await schema.db.insert(core_content_containers).values(
        [
          { id: FORUM.OPEN, parentId: null },
          { id: FORUM.PRIVATE, parentId: null },
          { id: FORUM.PRIVATE_CHILD, parentId: FORUM.PRIVATE },
        ].map(({ id, parentId }) => ({
          definitionId: forumContainers.id,
          id,
          name: `Forum ${id}`,
          parentId,
          pluginId: PLUGIN_ID,
          position: id,
          slug: `forum-${id}`,
        })),
      );
      await schema.db.insert(core_content_access_rules).values([
        {
          action: "read",
          family: forumContainers.id,
          mode: "members",
          scopeId: String(FORUM.PRIVATE),
        },
        {
          action: "read",
          family: categoryType.id,
          mode: "members",
          scopeId: String(CATEGORY.MEMBERS),
        },
      ]);
      await schema.db
        .insert(core_reactions)
        .values({ code: "like", icon: "emoji:👍", kind: "emoji" });
    }, 120_000);

    afterAll(async () => {
      await schema?.drop();
    });

    beforeEach(async () => {
      await schema.client.unsafe(
        `truncate ${CONTENT_TABLES} restart identity cascade`,
      );
      await seed();
    });

    describe("counts", () => {
      it("counts each listed type once per record and totals them", async () => {
        await expect(count(USER.ALICE)).resolves.toEqual(ALICE_STATS);
        await expect(count(USER.BOB)).resolves.toEqual({
          byType: { [ARTICLE]: 1, [COMMENT]: 1, [TOPIC]: 1 },
          total: 3,
        });
      });

      it("reports every listed type for a member with nothing published", async () => {
        await expect(count(USER.CAROL)).resolves.toEqual({
          byType: { [ARTICLE]: 0, [COMMENT]: 0, [TOPIC]: 0 },
          total: 0,
        });
      });

      it("leaves out a type the app did not register", async () => {
        await expect(count(USER.ALICE, coreWithoutComments)).resolves.toEqual({
          byType: { [ARTICLE]: 2, [TOPIC]: 1 },
          total: 3,
        });
        const filtered = await page(USER.ALICE, {
          core: coreWithoutComments,
          type: COMMENT,
        });
        expect(filtered).toEqual({
          cards: [],
          endCursor: null,
          hasNextPage: false,
        });
        expect(
          entries(
            (await page(USER.ALICE, { core: coreWithoutComments })).cards,
          ),
        ).toEqual([
          `${TOPIC}:${TOP.OPEN}`,
          `${ARTICLE}:${ART.POLISH}`,
          `${ARTICLE}:${ART.SHARED}`,
        ]);
      });
    });

    describe("the list", () => {
      it("lists what a guest can open, newest first, the same records it counts", async () => {
        const result = await page(USER.ALICE);

        expect(entries(result.cards)).toEqual(ALICE_ENTRIES);
        expect(result).toMatchObject({ endCursor: null, hasNextPage: false });
      });

      it("is the guest's view whoever is signed in", async () => {
        const asGuest = await page(USER.ALICE);
        const statsAsGuest = await countContentProfile(await contextAs(null), {
          userId: USER.ALICE,
        });

        for (const viewer of [USER.ALICE, USER.MEMBER, USER.ROOT]) {
          expect(await page(USER.ALICE, { viewer })).toEqual(asGuest);
          await expect(
            countContentProfile(await contextAs(viewer), {
              userId: USER.ALICE,
            }),
          ).resolves.toEqual(statsAsGuest);
        }
      });

      it("credits a shared article to every author, in credit order", async () => {
        const shared = (await page(USER.BOB, { type: ARTICLE })).cards;

        expect(entries(shared)).toEqual([`${ARTICLE}:${ART.SHARED}`]);
        expect(shared[0]?.authors.map(author => author.nameCode)).toEqual([
          "alice",
          "bob",
        ]);
      });

      it.each([
        ["pl", ART.SHARED, "pl"],
        ["en", ART.SHARED, "en"],
        ["de", ART.SHARED, "en"],
        [undefined, ART.SHARED, "en"],
        ["en", ART.POLISH, "pl"],
      ])(
        "shows a translated article once, asked for %s: article %i in %s",
        async (locale, articleId, shown) => {
          const cards = (await page(USER.ALICE, { locale, type: ARTICLE }))
            .cards;
          const card = cards.find(entry => entry.itemId === articleId);

          expect(entries(cards)).toEqual([
            `${ARTICLE}:${ART.POLISH}`,
            `${ARTICLE}:${ART.SHARED}`,
          ]);
          expect(card).toMatchObject({
            languageCode: shown,
            title: `Article ${articleId} ${shown.toUpperCase()}`,
          });
        },
      );
    });

    describe("changes show on the next read", () => {
      const set = async (
        model: typeof comments | typeof topics,
        id: number,
        values: Record<string, unknown>,
      ) => {
        await schema.db
          .update(model.table)
          .set(values)
          .where(eq(model.columns.id, id));
      };

      it("drops an unpublished topic and brings it back when it is published again", async () => {
        await set(topics, TOP.OPEN, {
          publishedAt: null,
          status: "draft",
        });

        // Its comment goes with it: a guest cannot open the thread.
        await expect(count(USER.ALICE)).resolves.toEqual({
          byType: { [ARTICLE]: 2, [COMMENT]: 1, [TOPIC]: 0 },
          total: 3,
        });
        expect(entries((await page(USER.ALICE)).cards)).toEqual([
          `${COMMENT}:${COM.ON_BOB}`,
          `${ARTICLE}:${ART.POLISH}`,
          `${ARTICLE}:${ART.SHARED}`,
        ]);

        await set(topics, TOP.OPEN, {
          publishedAt: at(20),
          status: "published",
        });
        await expect(count(USER.ALICE)).resolves.toEqual(ALICE_STATS);
        expect(entries((await page(USER.ALICE)).cards)).toEqual(ALICE_ENTRIES);
      });

      it("counts a hidden comment again once it is restored", async () => {
        await set(comments, COM.HIDDEN, { hiddenAt: null });

        await expect(count(USER.ALICE)).resolves.toMatchObject({
          byType: { [COMMENT]: 3 },
          total: 6,
        });
        expect(entries((await page(USER.ALICE)).cards)[0]).toBe(
          `${COMMENT}:${COM.HIDDEN}`,
        );
      });

      it("forgets a deleted comment and a deleted topic with its thread", async () => {
        await set(comments, COM.ON_BOB, { deletedAt: at(70) });
        await expect(count(USER.ALICE)).resolves.toMatchObject({
          byType: { [COMMENT]: 1 },
          total: 4,
        });

        await schema.db
          .delete(topics.table)
          .where(eq(topics.columns.id, TOP.OPEN));
        await expect(count(USER.ALICE)).resolves.toEqual({
          byType: { [ARTICLE]: 2, [COMMENT]: 0, [TOPIC]: 0 },
          total: 2,
        });
        expect(entries((await page(USER.ALICE)).cards)).toEqual([
          `${ARTICLE}:${ART.POLISH}`,
          `${ARTICLE}:${ART.SHARED}`,
        ]);
      });

      it("moves the count and the entry with the credited authors", async () => {
        await schema.db
          .delete(articleAuthors)
          .where(eq(articleAuthors.itemId, ART.SHARED));
        await schema.db.insert(articleAuthors).values(
          [USER.BOB, USER.CAROL].map((relatedItemId, position) => ({
            itemId: ART.SHARED,
            position,
            relatedItemId,
          })) as never,
        );
        await set(topics, TOP.OPEN, { author: USER.CAROL });

        await expect(count(USER.ALICE)).resolves.toMatchObject({
          byType: { [ARTICLE]: 1, [TOPIC]: 0 },
        });
        await expect(count(USER.CAROL)).resolves.toEqual({
          byType: { [ARTICLE]: 1, [COMMENT]: 0, [TOPIC]: 1 },
          total: 2,
        });
        expect(entries((await page(USER.CAROL)).cards)).toEqual([
          `${TOPIC}:${TOP.OPEN}`,
          `${ARTICLE}:${ART.SHARED}`,
        ]);
        expect(entries((await page(USER.ALICE)).cards)).not.toContain(
          `${ARTICLE}:${ART.SHARED}`,
        );
      });
    });

    describe("pages", () => {
      it("fills a filtered page even when newer records of other types fill the unfiltered one", async () => {
        for (let index = 0; index < 12; index++) {
          await insertTopic({
            author: USER.ALICE,
            id: 100 + index,
            minute: 100 + index,
          });
        }

        const unfiltered = await page(USER.ALICE, { first: 5 });
        expect(unfiltered.cards.every(card => card.itemType === TOPIC)).toBe(
          true,
        );

        await expect(
          page(USER.ALICE, { first: 5, type: ARTICLE }),
        ).resolves.toMatchObject({ endCursor: null, hasNextPage: false });
        expect(
          entries((await page(USER.ALICE, { first: 5, type: ARTICLE })).cards),
        ).toEqual([`${ARTICLE}:${ART.POLISH}`, `${ARTICLE}:${ART.SHARED}`]);
      });

      describe("with records published at the same moment", () => {
        // Carol's records all share one publication time, with ids on both
        // sides of 9/10 so a text sort of the ids would put them out of order.
        const TIED = [9, 10, 11];
        const expected = [
          ...TIED.map(id => `${TOPIC}:${100 + id}`).reverse(),
          ...TIED.map(id => `${COMMENT}:${100 + id}`).reverse(),
          ...TIED.map(id => `${ARTICLE}:${id}`).reverse(),
          `${TOPIC}:200`,
        ];

        beforeEach(async () => {
          await insertTopic({ author: USER.BOB, id: 300, minute: 90 });
          for (const id of TIED) {
            await insertArticle({ authors: [USER.CAROL], id, minute: 80 });
            await insertTopic({ author: USER.CAROL, id: 100 + id, minute: 80 });
            await insertComment({
              author: USER.CAROL,
              id: 100 + id,
              minute: 80,
              topic: 300,
            });
          }
          await insertTopic({ author: USER.CAROL, id: 200, minute: 70 });
        });

        it.each([1, 2, 3, 4, 50])(
          "walks every record once, %i per page, in a stable order",
          async first => {
            await expect(walk(USER.CAROL, { first })).resolves.toEqual(
              expected,
            );
          },
        );

        it.each([ARTICLE, COMMENT, TOPIC])(
          "walks the %s filter to its count",
          async type => {
            const seen = await walk(USER.CAROL, { first: 2, type });

            expect(seen).toEqual(
              expected.filter(entry => entry.startsWith(`${type}:`)),
            );
            expect(seen).toHaveLength(
              (await count(USER.CAROL)).byType[type] ?? -1,
            );
          },
        );
      });
    });

    describe("routes", () => {
      const decode = (cursor: string): unknown =>
        JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));

      const contentCursorOf = async (userId: number, type?: string) => {
        const { body } = await timeline(
          userId,
          `?kind=content&first=1${type ? `&type=${type}` : ""}`,
        );
        if (!body.pageInfo.endCursor) throw new Error("no next page");

        return body.pageInfo.endCursor;
      };

      beforeEach(async () => {
        const [reaction] = await schema.db
          .select({ id: core_reactions.id })
          .from(core_reactions);
        await schema.db.insert(core_reactions_entries).values(
          ["1", "2"].map(targetId => ({
            pluginId: PLUGIN_ID,
            reactionId: reaction.id,
            targetId,
            targetType: reactionTarget.type,
            userId: USER.ALICE,
          })),
        );
      });

      it("adds the guest's counts and the listed types to the profile", async () => {
        const response = await app.request("/users/profile/alice", {
          headers: { "x-user": String(USER.ROOT) },
        });

        expect(response.status).toBe(200);
        expect(
          ((await response.json()) as { contentStats: unknown }).contentStats,
        ).toEqual({
          ...ALICE_STATS,
          types: [
            { id: ARTICLE, label: `${PLUGIN_ID}.content.article.label` },
            {
              id: COMMENT,
              label: `${PLUGIN_ID}.content.comment.profile_label`,
            },
            { id: TOPIC, label: `${PLUGIN_ID}.content.topic.profile_label` },
          ],
        });
      });

      it("lists only authored records with kind=content, and reactions without it", async () => {
        const content = await timeline(USER.ALICE, "?kind=content");
        expect(content.status).toBe(200);
        expect(
          content.body.edges.map(
            edge => `${edge.kind}:${edge.item?.itemType}:${edge.item?.itemId}`,
          ),
        ).toEqual(ALICE_ENTRIES.map(entry => `authored:${entry}`));

        const activity = await timeline(USER.ALICE, "?first=1");
        expect(activity.status).toBe(200);
        expect(activity.body.edges.map(edge => edge.kind)).toEqual([
          "reaction",
        ]);
        // Activity keeps its own cursor, never the content list's.
        expect(decode(activity.body.pageInfo.endCursor ?? "")).toEqual({
          r: expect.any(Number),
          rd: false,
          s: null,
          sd: true,
        });
      });

      it("pages kind=content with a cursor of its own", async () => {
        const cursor = await contentCursorOf(USER.ALICE);
        const next = await timeline(
          USER.ALICE,
          `?kind=content&first=1&cursor=${cursor}`,
        );

        expect(next.status).toBe(200);
        expect(next.body.edges.map(edge => edge.item?.itemId)).toEqual([
          COM.ON_BOB,
        ]);
      });

      it.each<[string, string, () => Promise<string> | string]>([
        ["an unknown type", "type", () => "?kind=content&type=ptest.note"],
        ["a type without kind=content", "type", () => `?type=${TOPIC}`],
        [
          "a malformed cursor",
          "cursor",
          () => "?kind=content&cursor=bm90LWEtY3Vyc29y",
        ],
        [
          "another member's cursor",
          "cursor",
          async () => `?kind=content&cursor=${await contentCursorOf(USER.BOB)}`,
        ],
        [
          "a cursor of another filter",
          "cursor",
          async () =>
            `?kind=content&type=${COMMENT}&cursor=${await contentCursorOf(USER.ALICE, ARTICLE)}`,
        ],
        [
          "a filtered cursor on the whole list",
          "cursor",
          async () =>
            `?kind=content&cursor=${await contentCursorOf(USER.ALICE, COMMENT)}`,
        ],
        [
          "an activity cursor",
          "cursor",
          async () => {
            const { body } = await timeline(USER.ALICE, "?first=1");

            return `?kind=content&cursor=${body.pageInfo.endCursor ?? ""}`;
          },
        ],
      ])(
        "answers 400 to %s on `%s`, in the validator's shape",
        async (_name, field, query) => {
          const response = await app.request(
            `/users/${USER.ALICE}/timeline${await query()}`,
          );
          const body = (await response.json()) as {
            error: { message: string; name: string };
            success: boolean;
          };

          expect(response.status).toBe(400);
          expect(body).toMatchObject({
            error: { name: "ZodError" },
            success: false,
          });
          expect(JSON.parse(body.error.message)).toMatchObject([
            { path: [field] },
          ]);
        },
      );

      it("answers 404 for a member that does not exist", async () => {
        await expect(timeline(999, "?kind=content")).resolves.toMatchObject({
          status: 404,
        });
      });
    });
  },
);
