// @vitest-environment node
import type { Context } from "hono";

import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { ZodError } from "zod";

import {
  core_content_file_refs,
  core_content_revisions,
} from "@/database/content";
import { core_files } from "@/database/files";
import { core_languages } from "@/database/languages";
import { core_roles } from "@/database/roles";
import { core_users } from "@/database/users";
import {
  createTestDatabase,
  describePostgres,
  type TestDatabaseHandle,
} from "@/tests/postgres";

import { defineContentType } from "../define";
import { field } from "../fields";
import { createContentModel } from "./model";

const PLUGIN_ID = "@vitnode/test";
const ACTOR = { type: "system" as const, userId: null };

const article = defineContentType({
  id: "test.richtext",
  tableName: "test_rich_articles",
  localization: { enabled: true, defaultLocale: "en" },
  editorial: { enabled: true },
  fields: {
    title: field.text({ required: true }),
    intro: field.richText({ nullable: true, maxLength: 20 }),
    body: field.richText({ localized: true, required: true }),
    seo: field.group({
      fields: { summary: field.richText({ nullable: true }) },
    }),
    faq: field.repeatable({
      fields: { answer: field.richText({ required: true }) },
    }),
  },
  admin: { list: { searchableFields: ["title", "intro", "body"] } },
});

const model = createContentModel(article);

const MALICIOUS = [
  "<p>Hi<script>alert(1)</script></p>",
  '<p onclick="steal()">Hi</p>',
  '<p><a href="javascript:alert(1)">Hi</a></p>',
  '<p>Hi<img src="data:image/png;base64,AAAA" onerror="x()"></p>',
];

describePostgres("rich text writes", () => {
  let database: TestDatabaseHandle;
  let c: Context;

  const freshContext = (): Context => {
    const vars = new Map<string, unknown>([["db", database.db]]);

    return {
      get: (key: string) => vars.get(key),
      set: (key: string, value: unknown) => vars.set(key, value),
    } as unknown as Context;
  };

  const base = () => model.service(c);
  const editorial = () => {
    const build = model.editorialService;
    if (!build) throw new Error("editorial is enabled on the fixture");

    return build(c, { pluginId: PLUGIN_ID });
  };
  const translationEditorial = () => {
    const build = model.translationEditorialService;
    if (!build) throw new Error("the fixture is localized and editorial");

    return build(c, { pluginId: PLUGIN_ID });
  };
  const localized = () => {
    const build = model.localizedService;
    if (!build) throw new Error("the fixture is localized");

    return build(c, { pluginId: PLUGIN_ID });
  };

  const rawRow = async (id: number) => {
    const [row] = await database.db
      .select()
      .from(model.table)
      .where(eq(model.table.id, id));

    return row as Record<string, unknown>;
  };

  const rawTranslation = async (itemId: number) => {
    const translationTable = model.translationTable;
    if (!translationTable) throw new Error("the fixture is localized");

    const [row] = await database.db
      .select()
      .from(translationTable)
      .where(eq(translationTable.itemId, itemId));

    return row as Record<string, unknown>;
  };

  const issuePaths = async (run: () => Promise<unknown>) => {
    try {
      await run();
    } catch (error) {
      if (error instanceof ZodError) {
        return error.issues.map(issue => issue.path.join("."));
      }
      throw error;
    }

    throw new Error("expected the write to be refused");
  };

  beforeAll(async () => {
    database = await createTestDatabase({
      core_content_file_refs,
      core_content_revisions,
      core_files,
      core_languages,
      core_roles,
      core_users,
      [article.tableName]: model.table,
      ...(model.translationTable
        ? { translations: model.translationTable }
        : {}),
      ...model.advancedTables.repeatables,
    });

    await database.db.insert(core_languages).values([
      { code: "en", default: true, name: "English", timezone: "UTC" },
      { code: "pl", name: "Polski", timezone: "UTC" },
    ]);
  });

  afterAll(async () => {
    await database?.drop();
  });

  beforeEach(() => {
    c = freshContext();
  });

  it.each(MALICIOUS)(
    "stores sanitised HTML from a direct service create: %s",
    async html => {
      const row = await base().create({
        faq: [{ answer: html }],
        intro: html,
        seo: { summary: html },
        title: "Hello",
      });
      const detail = await base().findDetail(row.id);

      for (const stored of [
        row.intro,
        row.seo?.summary,
        detail?.faq[0]?.answer,
      ]) {
        expect(stored).toContain("Hi");
        expect(stored).not.toMatch(/script|onclick|onerror|javascript:|data:/);
      }
    },
  );

  it("stores an empty optional body as null and keeps its search text in step", async () => {
    const row = await base().create({
      intro: "<p>Tom &amp; <strong>Jerry</strong></p>",
      title: "Search text",
    });
    expect((await rawRow(row.id)).introText).toBe("Tom & Jerry");

    const updated = await base().update(row.id, { intro: "<p><br></p>" });

    expect(updated?.row.intro).toBeNull();
    expect((await rawRow(row.id)).introText).toBeNull();
  });

  it("counts plain text, not markup, against maxLength", async () => {
    const markup = `<p><span style="color: red">${"a".repeat(20)}</span></p>`;
    const row = await base().create({ intro: markup, title: "Bounds" });
    expect(row.intro).toContain("a".repeat(20));

    expect(
      await issuePaths(
        async () =>
          await base().update(row.id, { intro: `<p>${"a".repeat(21)}</p>` }),
      ),
    ).toEqual(["intro"]);
  });

  it("refuses a required leaf that sanitises to nothing, at its own path", async () => {
    expect(
      await issuePaths(
        async () =>
          await base().create({
            faq: [{ answer: "<p>ok</p>" }, { answer: "<script>x()</script>" }],
            title: "Required",
          }),
      ),
    ).toEqual(["faq.1.answer"]);
  });

  it("accepts a required body that is only media", async () => {
    const { translation } = await localized().create(
      {
        shared: { title: "Media" },
        translation: { body: '<p><img src="https://example.com/a.png"></p>' },
      },
      { actor: ACTOR },
    );

    expect(translation.values.body).toContain("<img");
    expect((await rawTranslation(translation.itemId)).bodyText).toBe("");
  });

  it("sanitises a localized composite create and refuses an empty body", async () => {
    const { translation } = await localized().create(
      {
        shared: { title: "Localized" },
        translation: {
          body: '<p onclick="x()">Witaj <strong>świecie</strong></p>',
        },
      },
      { actor: ACTOR },
    );

    expect(translation.values.body).toBe(
      "<p>Witaj <strong>świecie</strong></p>",
    );
    expect((await rawTranslation(translation.itemId)).bodyText).toBe(
      "Witaj świecie",
    );

    for (const body of ["<p></p>", "<p>&nbsp;</p>", "<script>x()</script>"]) {
      expect(
        await issuePaths(
          async () =>
            await localized().create(
              { shared: { title: "Empty" }, translation: { body } },
              { actor: ACTOR },
            ),
        ),
      ).toEqual(["body"]);
    }
  });

  it("sanitises a translation update made through the translation editorial service", async () => {
    const { row } = await localized().create(
      { shared: { title: "Translate" }, translation: { body: "<p>Hello</p>" } },
      { actor: ACTOR },
    );

    const created = await translationEditorial().create(
      row.id,
      "pl",
      { body: "<p>Cześć<script>x()</script></p>" },
      { actor: ACTOR },
    );
    expect(created.row.values.body).toBe("<p>Cześć</p>");

    const updated = await translationEditorial().update(
      row.id,
      "pl",
      { body: '<p><a href="javascript:x()">Hej</a></p>' },
      { actor: ACTOR, expectedVersion: created.version },
    );
    expect(updated?.row.values.body).toBe("<p><a>Hej</a></p>");
  });

  it("sanitises a value a base revision restore brings back", async () => {
    const created = await editorial().create(
      { intro: "<p>First</p>", title: "Restore" },
      { actor: ACTOR },
    );
    const revisionId = created.revisionId ?? 0;
    // A revision written before the field was rich text - or by anything that
    // wrote around the service - can hold markup the sanitiser would refuse.
    await database.db.execute(
      sql`update core_content_revisions set snapshot = jsonb_set(snapshot, '{fields,intro}', to_jsonb(${"<p>Old<script>x()</script></p>"}::text)) where id = ${revisionId}`,
    );
    const updated = await editorial().update(
      created.row.id,
      { intro: "<p>Second</p>" },
      { actor: ACTOR, expectedVersion: created.version },
    );

    const restored = await editorial().restore(created.row.id, revisionId, {
      actor: ACTOR,
      expectedVersion: updated?.version ?? 0,
    });

    expect(restored?.row.intro).toBe("<p>Old</p>");
    expect((await rawRow(created.row.id)).introText).toBe("Old");
  });

  it("sanitises a value a translation revision restore brings back", async () => {
    const { row } = await localized().create(
      { shared: { title: "Restore" }, translation: { body: "<p>First</p>" } },
      { actor: ACTOR },
    );
    const [revision] = await database.db
      .select({ id: core_content_revisions.id })
      .from(core_content_revisions)
      .where(eq(core_content_revisions.itemId, String(row.id)))
      .orderBy(core_content_revisions.id)
      .limit(1);
    await database.db.execute(
      sql`update core_content_revisions set snapshot = jsonb_set(snapshot, '{fields,body}', to_jsonb(${'<p onclick="x()">Old</p>'}::text)) where id = ${revision.id}`,
    );
    const updated = await translationEditorial().update(
      row.id,
      "en",
      { body: "<p>Second</p>" },
      { actor: ACTOR, expectedVersion: 1 },
    );

    const restored = await translationEditorial().restore(
      row.id,
      "en",
      revision.id,
      { actor: ACTOR, expectedVersion: updated?.version ?? 0 },
    );

    expect(restored?.row.values.body).toBe("<p>Old</p>");
    expect((await rawTranslation(row.id)).bodyText).toBe("Old");
  });

  it("matches the words of a rich text field in the admin list search, never its markup", async () => {
    await base().create({
      intro: '<p><span style="color: red">Avocado</span></p>',
      title: "Shared search",
    });
    await localized().create(
      {
        shared: { title: "Localized search" },
        translation: { body: '<p><span style="color: red">Kiwi</span></p>' },
      },
      { actor: ACTOR },
    );

    const titles = async (search: string) =>
      (await base().findMany({ query: { search } })).edges.map(
        edge => edge.title,
      );

    expect(await titles("avocado")).toEqual(["Shared search"]);
    expect(await titles("kiwi")).toEqual(["Localized search"]);
    expect(await titles("color")).toEqual([]);
    expect(await titles("span")).toEqual([]);
  });
});
