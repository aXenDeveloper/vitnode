import type { Context } from "hono";

import { inArray, sql } from "drizzle-orm";

import type { AutoTranslateSource } from "../../content/auto-translate/segments";
import type { AutoTranslateTextClass } from "../../content/auto-translate/text";
import type { AnyContentModel } from "../../content/server/model";
import type { ResolvedContentAutoTranslateField } from "../../content/types";
import type { LanguageDetection } from "./detect";

import { CONTENT_ACCESS_GUEST } from "../../content/access/server/actor";
import { autoTranslateSource } from "../../content/auto-translate/segments";
import { sha256Hex } from "../../content/auto-translate/sha256";
import { autoTranslateFingerprint } from "../../content/auto-translate/source-hash";
import { classifyTranslatableText } from "../../content/auto-translate/text";
import { contentIdKey, parseContentIdOf } from "../../content/ids";
import {
  contentDefinitionOf,
  findContentModel,
} from "../../content/server/model";
import { core_content_language_detections } from "../../database/content-translations";
import { detectLanguage, LANGUAGE_DETECTOR_VERSION } from "./detect";

/** One field of a readable record, ready to look up or translate. */
export interface AutoTranslateFieldSource {
  /** The detected language, borrowed from `languageFrom` when this one is unsure. */
  detection: LanguageDetection;
  fingerprint: string;
  name: string;
  source: AutoTranslateSource;
  textClass: AutoTranslateTextClass;
  value: unknown;
}

/** A record every guest may read, with its translatable fields. */
export interface AutoTranslateTarget {
  contentTypeId: string;
  fields: Map<string, AutoTranslateFieldSource>;
  recordId: string;
  /**
   * On a localized content type, the language the record was served in for
   * the target locale: the reader's own (an editorial translation) or the
   * default one standing in for it. `null` otherwise.
   */
  recordLocale: null | string;
}

export const autoTranslateTargetKey = (
  contentTypeId: string,
  recordId: number | string,
) => `${contentTypeId}:${String(recordId)}`;

/** The registered model of a content type that opted into `autoTranslate`. */
export const autoTranslateModel = (
  c: Context,
  contentTypeId: string,
): AnyContentModel | null => {
  const model = findContentModel(
    c.get("core")?.contentModels ?? [],
    contentTypeId,
  )?.model;
  if (!model) return null;
  const definition = contentDefinitionOf(model);

  return definition.autoTranslate.enabled && model.publicService ? model : null;
};

type Db = Context["var"]["db"];

const detectAll = async (
  db: Db,
  texts: string[],
  { persist }: { persist: boolean },
): Promise<Map<string, LanguageDetection>> => {
  const byFingerprint = new Map(texts.map(text => [sha256Hex(text), text]));
  const result = new Map<string, LanguageDetection>();
  if (byFingerprint.size === 0) return result;

  const stored = await db
    .select()
    .from(core_content_language_detections)
    .where(
      inArray(core_content_language_detections.textFingerprint, [
        ...byFingerprint.keys(),
      ]),
    );
  const current = new Map(
    stored
      .filter(row => row.detectorVersion === LANGUAGE_DETECTOR_VERSION)
      .map(row => [row.textFingerprint, row]),
  );
  const fresh: (LanguageDetection & { textFingerprint: string })[] = [];
  for (const [textFingerprint, text] of byFingerprint) {
    const known = current.get(textFingerprint);
    const detection = known
      ? { confident: known.confident, locale: known.locale }
      : detectLanguage(text);
    result.set(text, detection);
    if (!known) fresh.push({ ...detection, textFingerprint });
  }
  if (persist && fresh.length > 0) {
    await db
      .insert(core_content_language_detections)
      .values(
        fresh.map(detection => ({
          ...detection,
          detectorVersion: LANGUAGE_DETECTOR_VERSION,
        })),
      )
      .onConflictDoUpdate({
        set: {
          confident: sql`excluded."confident"`,
          detectorVersion: sql`excluded."detectorVersion"`,
          locale: sql`excluded."locale"`,
        },
        target: core_content_language_detections.textFingerprint,
      });
  }

  return result;
};

/**
 * Loads the records of a batch that every guest may read right now -
 * published, not hidden, not awaiting approval, in an open container and
 * under a readable parent - through each content type's own public read
 * service. Anything else is simply missing from the result, so a caller can
 * never tell a draft from a record that does not exist.
 *
 * The server computes each field's fingerprint, skip class and language from
 * the stored value; nothing a client sends is trusted. Server-only.
 *
 * A localized content type is read in `locale`, the target language, so an
 * editorial translation is found first and only the default language served
 * in its place is translated. Its fields are fingerprinted with the served
 * language, which the page passes as `recordLocale`.
 *
 * @param persist Store newly detected languages. Off for read-only lookups.
 * @param locale The language being translated into.
 */
export const loadAutoTranslateTargets = async (
  c: Context,
  items: readonly { contentTypeId: string; id: number | string }[],
  { locale, persist = false }: { locale: string; persist?: boolean },
): Promise<Map<string, AutoTranslateTarget>> => {
  const byType = new Map<string, (number | string)[]>();
  for (const item of items) {
    const ids = byType.get(item.contentTypeId) ?? [];
    ids.push(item.id);
    byType.set(item.contentTypeId, ids);
  }

  const pending: {
    contentTypeId: string;
    fields: ResolvedContentAutoTranslateField[];
    recordId: string;
    recordLocale: null | string;
    row: Record<string, unknown>;
  }[] = [];

  for (const [contentTypeId, rawIds] of byType) {
    const model = autoTranslateModel(c, contentTypeId);
    if (!model?.publicService) continue;
    const definition = contentDefinitionOf(model);
    const ids = [
      ...new Set(
        rawIds
          .map(raw => parseContentIdOf(definition, raw))
          .filter(id => id !== null),
      ),
    ];
    if (ids.length === 0) continue;
    const service = model.publicService(c);

    let rows: Record<string, unknown>[];
    if (definition.localization.enabled) {
      const found = await Promise.all(
        ids.map(
          async id =>
            (await service.findById(id, {
              actor: CONTENT_ACCESS_GUEST,
              locale,
            })) as null | Record<string, unknown>,
        ),
      );
      rows = found.filter(row => row !== null);
    } else if (service.findManyByIds) {
      rows = await service.findManyByIds(ids, {
        actor: CONTENT_ACCESS_GUEST,
      });
    } else {
      continue;
    }
    for (const row of rows) {
      pending.push({
        contentTypeId,
        fields: definition.autoTranslate.fields,
        recordId: contentIdKey(row.id as number | string),
        recordLocale:
          definition.localization.enabled && typeof row.locale === "string"
            ? row.locale
            : null,
        row,
      });
    }
  }

  const prepared = pending.map(entry => ({
    ...entry,
    sources: entry.fields.map(field => {
      const value = entry.row[field.name];
      const source = autoTranslateSource(value);

      return {
        field,
        source,
        textClass: classifyTranslatableText(source.plain),
        value,
      };
    }),
  }));

  const detections = await detectAll(
    c.get("db"),
    prepared.flatMap(entry =>
      entry.sources
        .filter(source => !(source.field.localized && entry.recordLocale))
        .map(source => source.source.plain)
        .filter(text => text.trim() !== ""),
    ),
    { persist },
  );
  const none: LanguageDetection = { confident: false, locale: null };

  const targets = new Map<string, AutoTranslateTarget>();
  for (const entry of prepared) {
    const own = new Map(
      entry.sources.map(source => [
        source.field.name,
        source.field.localized && entry.recordLocale
          ? { confident: true, locale: entry.recordLocale }
          : (detections.get(source.source.plain) ?? none),
      ]),
    );
    const fields = new Map<string, AutoTranslateFieldSource>();
    for (const { field, source, textClass, value } of entry.sources) {
      const detection = own.get(field.name) ?? none;
      const borrowed = field.languageFrom
        ? own.get(field.languageFrom)
        : undefined;
      fields.set(field.name, {
        detection:
          !detection.confident && borrowed?.confident ? borrowed : detection,
        fingerprint: autoTranslateFingerprint({
          field: field.name,
          sourceLocale: entry.recordLocale,
          value,
        }),
        name: field.name,
        source,
        textClass,
        value,
      });
    }
    targets.set(autoTranslateTargetKey(entry.contentTypeId, entry.recordId), {
      contentTypeId: entry.contentTypeId,
      fields,
      recordId: entry.recordId,
      recordLocale: entry.recordLocale,
    });
  }

  return targets;
};
