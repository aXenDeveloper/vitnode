import type { Context } from "hono";

import { eq } from "drizzle-orm";
import { getCookie, setCookie } from "hono/cookie";
import { z } from "zod";

import { buildRoute } from "@/builders";
import {
  AUTO_TRANSLATE_COOKIE,
  zodAutoTranslateLookupBody,
  zodAutoTranslateRequestBody,
  zodAutoTranslateResponse,
  zodAutoTranslateSettingsResponse,
} from "@/content/auto-translate/schemas";
import { core_users } from "@/database/users";
import {
  lookupAutoTranslations,
  requestAutoTranslations,
} from "@/lib/content-translation/service";
import { loadContentTranslationSettings } from "@/lib/content-translation/settings";

const json = <T extends z.ZodType>(schema: T, description: string) => ({
  content: { "application/json": { schema } },
  description,
});

const GUEST_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

const readMemberPreference = async (
  db: Context["var"]["db"],
  userId: number,
): Promise<boolean> => {
  const [row] = await db
    .select({ auto: core_users.autoTranslateContent })
    .from(core_users)
    .where(eq(core_users.id, userId))
    .limit(1);

  return row?.auto ?? true;
};

export const autoTranslateSettingsRoute = buildRoute({
  route: {
    method: "get",
    path: "/translations/settings",
    description:
      "Whether automatic translation is on for the site and for this reader, and which languages it covers",
    responses: {
      200: json(zodAutoTranslateSettingsResponse, "Translation settings"),
    },
  },
  handler: async c => {
    const settings = await loadContentTranslationSettings(c);
    const user = c.get("user");
    const auto = user
      ? await readMemberPreference(c.get("db"), user.id)
      : getCookie(c, AUTO_TRANSLATE_COOKIE) !== "0";

    c.header("Cache-Control", "private, no-store");

    return c.json(
      {
        auto: settings.enabled && auto,
        canGenerate: settings.enabled && user !== null,
        enabled: settings.enabled,
        locales: settings.locales,
      },
      200,
    );
  },
});

export const autoTranslatePreferenceRoute = buildRoute({
  route: {
    method: "put",
    path: "/translations/preference",
    description:
      "Turn automatic translation on or off for this reader: stored on the account when signed in, in a cookie for guests",
    request: {
      body: {
        required: true,
        content: {
          "application/json": { schema: z.object({ auto: z.boolean() }) },
        },
      },
    },
    responses: {
      200: json(z.object({ auto: z.boolean() }), "Saved"),
    },
  },
  handler: async c => {
    const { auto } = c.req.valid("json");
    const user = c.get("user");
    if (user) {
      await c
        .get("db")
        .update(core_users)
        .set({ autoTranslateContent: auto })
        .where(eq(core_users.id, user.id));
    } else {
      const { cookieDomain, cookieSecure } = c.get("core").authorization;
      setCookie(c, AUTO_TRANSLATE_COOKIE, auto ? "1" : "0", {
        domain: cookieDomain,
        httpOnly: false,
        maxAge: GUEST_COOKIE_MAX_AGE,
        path: "/",
        sameSite: "Lax",
        secure: cookieSecure,
      });
    }
    c.header("Cache-Control", "private, no-store");

    return c.json({ auto }, 200);
  },
});

export const autoTranslateLookupRoute = buildRoute({
  route: {
    method: "post",
    path: "/translations/lookup",
    description:
      "Saved machine translations of public records in one language, with each field's state. Read-only: never queues work or calls a model",
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: zodAutoTranslateLookupBody } },
      },
    },
    responses: {
      200: json(zodAutoTranslateResponse, "Translation states"),
    },
  },
  handler: async c => {
    const result = await lookupAutoTranslations(c, c.req.valid("json"));
    c.header("Cache-Control", "private, no-store");

    return c.json(result, 200);
  },
});

export const autoTranslateRequestRoute = buildRoute({
  route: {
    method: "post",
    path: "/translations/request",
    description:
      "Saved machine translations of public records, and for a signed-in reader, new translations queued for the eligible misses",
    request: {
      body: {
        required: true,
        content: {
          "application/json": { schema: zodAutoTranslateRequestBody },
        },
      },
    },
    responses: {
      200: json(zodAutoTranslateResponse, "Translation states"),
    },
  },
  handler: async c => {
    const result = await requestAutoTranslations(c, c.req.valid("json"));
    c.header("Cache-Control", "private, no-store");

    return c.json(result, 200);
  },
});
