import type { Table } from "drizzle-orm";

import { OpenAPIHono } from "@hono/zod-openapi";
import { describe, expect, it } from "vitest";

import type { AutoTranslateResponse } from "@/content/auto-translate/schemas";
import type { RichTextDocument } from "@/content/rich-text/document";

import { AUTO_TRANSLATE_COOKIE } from "@/content/auto-translate/schemas";
import { autoTranslateFingerprint } from "@/content/auto-translate/source-hash";
import { defineContentType } from "@/content/define";
import { field } from "@/content/fields";
import { createContentModel } from "@/content/server/model";
import {
  core_content_ai_translation_jobs,
  core_content_ai_translations,
  core_content_language_detections,
  core_content_translation_settings,
} from "@/database/content-translations";
import { core_languages } from "@/database/languages";
import { core_users } from "@/database/users";
import { createTestCache } from "@/tests/cache";
import { createMemoryDb } from "@/tests/memory-db";

import {
  autoTranslateLookupRoute,
  autoTranslatePreferenceRoute,
  autoTranslateRequestRoute,
  autoTranslateSettingsRoute,
} from "./translations.routes";

const noteType = defineContentType({
  id: "test.translated-note",
  tableName: "test_translated_notes",
  publication: true,
  visibility: true,
  autoTranslate: {
    fields: ["summary", "body"],
    languageFrom: { summary: "body" },
  },
  fields: {
    title: field.text({ required: true, maxLength: 200 }),
    slug: field.slug({ source: "title" }),
    summary: field.richText({ required: true }),
    body: field.richText({ required: true }),
  },
  publicApi: {
    path: "translated-notes",
    fields: ["id", "title", "slug", "summary", "body", "publishedAt"],
  },
});
const notes = createContentModel(noteType);

const NOTE = { PUBLISHED: 1, DRAFT: 2, HIDDEN: 3, SCHEDULED: 4 } as const;
const MEMBER = 5;
const doc = (text: string): RichTextDocument => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

const BODY = doc(
  "Po aktualizacji nie mogę się zalogować na telefonie, czy ktoś wie co jest nie tak?",
);
const TITLE = "Problem z logowaniem";
const SUMMARY = doc(TITLE);
const LIVE = new Date("2026-09-01T10:00:00.000Z");

const note = (id: number, extra: Record<string, unknown> = {}) => ({
  body: BODY,
  createdAt: LIVE,
  hiddenAt: null,
  id,
  publishedAt: LIVE,
  slug: `note-${id}`,
  status: "published",
  summary: SUMMARY,
  title: TITLE,
  updatedAt: LIVE,
  ...extra,
});

const fingerprintOf = (name: "body" | "summary") =>
  autoTranslateFingerprint({
    field: name,
    value: name === "body" ? BODY : SUMMARY,
  });

const createWorld = ({ enabled = true }: { enabled?: boolean } = {}) => {
  const memory = createMemoryDb([
    [
      notes.table,
      [
        note(NOTE.PUBLISHED),
        note(NOTE.DRAFT, { publishedAt: null, status: "draft" }),
        note(NOTE.HIDDEN, { hiddenAt: LIVE }),
        note(NOTE.SCHEDULED, { publishedAt: new Date("2999-01-01") }),
      ],
    ],
    [
      core_content_translation_settings,
      [
        {
          enabled,
          id: 1,
          locales: ["en", "pl"],
          monthlyBudgetUsd: "5",
          retentionDays: 30,
          userHourlyLimit: 100,
        },
      ],
    ],
    [
      core_languages,
      [
        { code: "en", id: 1, name: "English" },
        { code: "pl", id: 2, name: "Polski" },
      ],
    ],
    [
      core_content_ai_translations,
      [
        {
          contentTypeId: noteType.id,
          field: "summary",
          id: 1,
          recordId: String(NOTE.PUBLISHED),
          sourceFingerprint: fingerprintOf("summary"),
          sourceLocale: "pl",
          targetKind: "content",
          targetLocale: "en",
          value: doc("Login problem"),
        },
      ],
    ],
    [core_content_ai_translation_jobs, []],
    [core_content_language_detections, []],
    [
      core_users,
      [
        {
          autoTranslateContent: null,
          avatarColor: "000000",
          email: "member@example.com",
          id: MEMBER,
          name: "Member",
          nameCode: "member",
          roleId: 3,
        },
      ],
    ],
  ] as [Table, readonly object[]][]);

  const cache = createTestCache();
  const app = new OpenAPIHono();
  app.use("*", async (c, next) => {
    const header = c.req.header("x-user");
    const values: Record<string, unknown> = {
      ai: {
        ledger: () => ({
          loadActionSettings: async () => await Promise.resolve(null),
          loadSettings: async () => await Promise.resolve({ enabled: true }),
        }),
      },
      cache,
      core: {
        ai: {
          models: [
            {
              capabilities: ["text", "structured-output"],
              id: "translator",
              model: "test/translator",
              pricing: {
                rates: { inputPerMillion: "1", outputPerMillion: "1" },
              },
            },
          ],
        },
        authorization: { cookieDomain: undefined, cookieSecure: false },
        contentModels: [{ model: notes, pluginId: "@vitnode/example" }],
      },
      db: memory.db,
      events: {
        emit: async () => await Promise.resolve({ failures: [] }),
      },
      user: header ? { id: Number(header), roleId: 3 } : null,
    };
    for (const [key, value] of Object.entries(values)) {
      c.set(key as never, value as never);
    }
    await next();
  });
  for (const { handler, route } of [
    autoTranslateSettingsRoute,
    autoTranslatePreferenceRoute,
    autoTranslateLookupRoute,
    autoTranslateRequestRoute,
  ]) {
    app.openapi(route as never, handler as never);
  }

  const send = async (
    method: string,
    path: string,
    {
      body,
      cookie,
      user,
    }: { body?: unknown; cookie?: string; user?: number } = {},
  ) =>
    await app.request(path, {
      method,
      headers: {
        "content-type": "application/json",
        ...(cookie === undefined ? {} : { cookie }),
        ...(user === undefined ? {} : { "x-user": String(user) }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

  return { memory, send };
};

const itemsFor = (ids: (number | string)[]) =>
  ids.map(id => ({
    contentTypeId: noteType.id,
    fields: [{ name: "summary" }, { name: "body" }],
    id,
  }));

const fieldsOf = (body: AutoTranslateResponse, id: number | string) =>
  body.items.find(item => item.id === String(id))?.fields;

describe("POST /translations/lookup", () => {
  it.each([
    ["a draft", NOTE.DRAFT],
    ["a hidden record", NOTE.HIDDEN],
    ["a scheduled record", NOTE.SCHEDULED],
    ["an unknown record", 999],
  ])("answers %s exactly like a missing one", async (_case, id) => {
    const { send } = createWorld();

    const response = await send("POST", "/translations/lookup", {
      body: { items: itemsFor([id]), locale: "en" },
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as AutoTranslateResponse;
    expect(fieldsOf(body, id)).toEqual(
      ["summary", "body"].map(name => ({
        fingerprint: null,
        name,
        reason: "not_found",
        state: "unavailable",
      })),
    );
  });

  it("answers an unknown content type the same way", async () => {
    const { send } = createWorld();

    const response = await send("POST", "/translations/lookup", {
      body: {
        items: [{ contentTypeId: "test.nope", fields: [{ name: "x" }], id: 1 }],
        locale: "en",
      },
    });

    expect(((await response.json()) as AutoTranslateResponse).items).toEqual([
      {
        contentTypeId: "test.nope",
        fields: [
          {
            fingerprint: null,
            name: "x",
            reason: "not_found",
            state: "unavailable",
          },
        ],
        id: "1",
      },
    ]);
  });

  it("serves the saved translation of a public record without queuing or storing anything", async () => {
    const { memory, send } = createWorld();

    const response = await send("POST", "/translations/lookup", {
      body: { items: itemsFor([NOTE.PUBLISHED]), locale: "en" },
    });

    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const body = (await response.json()) as AutoTranslateResponse;
    expect(fieldsOf(body, NOTE.PUBLISHED)).toEqual([
      {
        fingerprint: fingerprintOf("summary"),
        name: "summary",
        sourceLocale: "pl",
        state: "ready",
        value: doc("Login problem"),
      },
      { fingerprint: fingerprintOf("body"), name: "body", state: "missing" },
    ]);
    expect(memory.rows(core_content_ai_translation_jobs)).toEqual([]);
    expect(memory.rows(core_content_language_detections)).toEqual([]);
  });

  it("answers stale for a page that renders an older version", async () => {
    const { send } = createWorld();

    const response = await send("POST", "/translations/lookup", {
      body: {
        items: [
          {
            contentTypeId: noteType.id,
            fields: [{ fingerprint: "f".repeat(64), name: "summary" }],
            id: NOTE.PUBLISHED,
          },
        ],
        locale: "en",
      },
    });

    expect(
      fieldsOf(
        (await response.json()) as AutoTranslateResponse,
        NOTE.PUBLISHED,
      ),
    ).toEqual([
      {
        fingerprint: fingerprintOf("summary"),
        name: "summary",
        state: "stale",
      },
    ]);
  });

  it("answers disabled for everything while the site has it off", async () => {
    const { send } = createWorld({ enabled: false });

    const response = await send("POST", "/translations/lookup", {
      body: { items: itemsFor([NOTE.PUBLISHED]), locale: "en" },
    });

    expect(
      fieldsOf(
        (await response.json()) as AutoTranslateResponse,
        NOTE.PUBLISHED,
      ),
    ).toEqual(
      ["summary", "body"].map(name => ({
        fingerprint: null,
        name,
        reason: "disabled",
        state: "unavailable",
      })),
    );
  });
});

describe("POST /translations/request", () => {
  it("asks a guest to sign in instead of queuing, and still serves saved translations", async () => {
    const { memory, send } = createWorld();

    const response = await send("POST", "/translations/request", {
      body: {
        items: itemsFor([NOTE.PUBLISHED, NOTE.DRAFT]),
        locale: "en",
        mode: "manual",
      },
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as AutoTranslateResponse;
    expect(fieldsOf(body, NOTE.PUBLISHED)).toEqual([
      expect.objectContaining({ name: "summary", state: "ready" }),
      {
        fingerprint: fingerprintOf("body"),
        name: "body",
        reason: "sign_in",
        state: "unavailable",
      },
    ]);
    expect(fieldsOf(body, NOTE.DRAFT)).toEqual(
      ["summary", "body"].map(name => ({
        fingerprint: null,
        name,
        reason: "not_found",
        state: "unavailable",
      })),
    );
    expect(memory.rows(core_content_ai_translation_jobs)).toEqual([]);
  });
});

describe("the reader's preference", () => {
  it("keeps a guest's choice in a cookie the page can read", async () => {
    const { send } = createWorld();

    const response = await send("PUT", "/translations/preference", {
      body: { auto: false },
    });

    expect(response.status).toBe(200);
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${AUTO_TRANSLATE_COOKIE}=0`);
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).not.toContain("HttpOnly");

    const settings = await send("GET", "/translations/settings", {
      cookie: `${AUTO_TRANSLATE_COOKIE}=0`,
    });
    expect(await settings.json()).toEqual({
      auto: false,
      canGenerate: false,
      enabled: true,
      locales: ["en", "pl"],
    });
  });

  it("keeps a member's choice on the account, not in a cookie", async () => {
    const { memory, send } = createWorld();

    const response = await send("PUT", "/translations/preference", {
      body: { auto: false },
      user: MEMBER,
    });

    expect(response.headers.get("set-cookie")).toBeNull();
    expect(memory.rows(core_users)[0]?.autoTranslateContent).toBe(false);

    const settings = await send("GET", "/translations/settings", {
      cookie: `${AUTO_TRANSLATE_COOKIE}=1`,
      user: MEMBER,
    });
    expect(await settings.json()).toMatchObject({
      auto: false,
      canGenerate: true,
    });
  });
});
