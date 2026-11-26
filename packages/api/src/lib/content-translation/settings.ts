import type { Context } from "hono";

import { eq } from "drizzle-orm";

import { core_content_translation_settings } from "../../database/content-translations";
import { core_languages } from "../../database/languages";
import {
  DEFAULT_AI_MODEL_CAPABILITIES,
  missingCapabilities,
} from "../ai/capabilities";
import {
  CONTENT_TRANSLATE_AI_ACTION,
  contentTranslateAiAction,
} from "./action";

/** Site-wide automatic translation settings, as the service reads them. */
export interface ContentTranslationSettings {
  /**
   * The admin's site switch, on by default. Translations run only while it is
   * on and {@link contentTranslationModelReady} is true.
   */
  enabled: boolean;
  /** Allowed source and target languages, limited to the site's languages. */
  locales: string[];
  /** Dedicated monthly cap in USD, or `null` for none beyond the AI budgets. */
  monthlyBudgetUsd: null | string;
  /** Days a superseded translation is kept in case its source changes back. */
  retentionDays: number;
  /** New fields one reader may queue per hour. */
  userHourlyLimit: number;
}

export const CONTENT_TRANSLATION_DEFAULTS: ContentTranslationSettings = {
  enabled: true,
  locales: ["en", "pl"],
  monthlyBudgetUsd: "5",
  retentionDays: 30,
  userHourlyLimit: 100,
};

type Db = Context["var"]["db"];

const cache = new WeakMap<Context, Promise<ContentTranslationSettings>>();

/** The stored row, before it is narrowed to the site's languages. */
export const readContentTranslationSettings = async (
  db: Omit<Db, "$client">,
): Promise<ContentTranslationSettings> => {
  const [row] = await db
    .select()
    .from(core_content_translation_settings)
    .where(eq(core_content_translation_settings.id, 1))
    .limit(1);

  return row
    ? {
        enabled: row.enabled,
        locales: row.locales,
        monthlyBudgetUsd: row.monthlyBudgetUsd,
        retentionDays: row.retentionDays,
        userHourlyLimit: row.userHourlyLimit,
      }
    : CONTENT_TRANSLATION_DEFAULTS;
};

/**
 * Whether translations can run right now: AI is on, the translate action is
 * not disabled, and the model it would use has `text`, `structured-output`
 * and pricing. Server-only.
 */
export const contentTranslationModelReady = async (
  c: Context,
): Promise<boolean> => {
  const models = c.get("core")?.ai?.models ?? [];
  if (models.length === 0) return false;

  const ledger = c.get("ai").ledger();
  const [settings, action] = await Promise.all([
    ledger.loadSettings(),
    ledger.loadActionSettings(CONTENT_TRANSLATE_AI_ACTION),
  ]);
  if (!settings.enabled || action?.enabled === false) return false;

  const required = contentTranslateAiAction.requiredCapabilities;
  const canTranslate = (model: (typeof models)[number]) =>
    missingCapabilities(
      required,
      model.capabilities ?? DEFAULT_AI_MODEL_CAPABILITIES,
    ).length === 0;
  const model = action?.modelId
    ? models.find(entry => entry.id === action.modelId)
    : models.find(canTranslate);

  return model !== undefined && canTranslate(model) && Boolean(model.pricing);
};

/**
 * The effective settings for this request, read once. `enabled` is true only
 * while the site switch is on and a model can translate, so connecting a model
 * turns the feature on. `locales` keeps only languages that exist on the site,
 * so a removed language stops being translated.
 * Server-only.
 */
export const loadContentTranslationSettings = async (
  c: Context,
): Promise<ContentTranslationSettings> => {
  const remembered = cache.get(c);
  if (remembered) return await remembered;

  const load = async () => {
    const db = c.get("db");
    const [settings, languages] = await Promise.all([
      readContentTranslationSettings(db),
      db.select({ code: core_languages.code }).from(core_languages),
    ]);
    const site = new Set(languages.map(language => language.code));

    return {
      ...settings,
      enabled: settings.enabled && (await contentTranslationModelReady(c)),
      locales: settings.locales.filter(locale => site.has(locale)),
    };
  };
  const promise = load();
  cache.set(c, promise);

  return await promise;
};

/** Writes the settings row. Server-only. */
export const saveContentTranslationSettings = async (
  db: Omit<Db, "$client">,
  values: ContentTranslationSettings,
): Promise<void> => {
  await db
    .insert(core_content_translation_settings)
    .values({ id: 1, ...values })
    .onConflictDoUpdate({
      set: { ...values, updatedAt: new Date() },
      target: core_content_translation_settings.id,
    });
};
