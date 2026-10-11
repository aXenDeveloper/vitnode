import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Context } from "hono";

import { and, eq, inArray } from "drizzle-orm";

import type { ContentId, ContentIdOf } from "../ids";
import type { ContentActor } from "../revisions";
import type {
  AnyContentTypeDefinition,
  ContentFieldDescriptor,
  ContentFieldMap,
  ContentLocalizedUpdateValues,
  ContentSelect,
  ContentTranslationRow,
  ContentUpdateInput,
} from "../types";
import type { ContentAdvancedStore } from "./advanced-store";
import type { ContentEditorialOutcome } from "./editorial-service";
import type { ContentLanguage } from "./language-resolver";
import type { ContentDatabase } from "./service";
import type { ContentTranslationEditorialOutcome } from "./translation-editorial-service";

import {
  PG_ERROR_CODES,
  pgConstraintName,
  pgErrorCode,
} from "../../lib/api/pg-error";
import {
  CONTENT_DUPLICATE_SLUG_ATTEMPTS,
  CONTENT_DUPLICATE_SLUG_CANDIDATES,
  CONTENT_DUPLICATE_SLUG_SUFFIX,
  CONTENT_DUPLICATE_TITLE_SUFFIX,
  CONTENT_DUPLICATE_TITLE_SUFFIX_KEY,
  CONTENT_SLUG_DEFAULT_LENGTH,
} from "../const";
import {
  ContentDuplicateSlugConflict,
  ContentDuplicateUniqueRequired,
  ContentEngineError,
  ContentInputError,
} from "../errors";
import { parseContentId } from "../ids";
import { partitionContentFields } from "../localization";
import {
  contentColumnsToValues,
  contentInnerFields,
  contentStorageColumns,
  contentValuesToColumns,
} from "../paths";
import { slugify } from "../slug";
import { contentSlugHistoryFor } from "./delivery-writes";

export interface ContentDuplicateOptions<TDefinition> {
  overrides?: ContentUpdateInput<TDefinition>;
  translations?: Partial<
    Record<string, ContentLocalizedUpdateValues<TDefinition>>
  >;
  tx?: ContentDatabase;
}

export type ContentDuplicateOverrides<TDefinition> = Pick<
  ContentDuplicateOptions<TDefinition>,
  "overrides" | "translations"
>;

export interface ContentEditorialDuplicateOptions<
  TDefinition,
> extends ContentDuplicateOptions<TDefinition> {
  actor: ContentActor;
}

export interface ContentDuplicateResult<TDefinition> {
  row: ContentSelect<TDefinition>;
  skippedLocales: string[];
  sourceId: ContentIdOf<TDefinition>;
  translations: ContentTranslationRow<TDefinition>[];
}

export interface ContentEditorialDuplicateOutcome<
  TDefinition,
> extends ContentEditorialOutcome<TDefinition> {
  duplicatedFromId: ContentIdOf<TDefinition>;
  skippedLocales: string[];
  sourceId: ContentIdOf<TDefinition>;
  translations: ContentTranslationEditorialOutcome<TDefinition>[];
}

export interface ContentDuplicationMethods<TDefinition> {
  duplicate: (
    sourceId: ContentIdOf<TDefinition>,
    options?: ContentDuplicateOptions<TDefinition>,
  ) => Promise<ContentDuplicateResult<TDefinition> | null>;
}

export interface ContentEditorialDuplicationMethods<TDefinition> {
  duplicate: (
    sourceId: ContentIdOf<TDefinition>,
    options: ContentEditorialDuplicateOptions<TDefinition>,
  ) => Promise<ContentEditorialDuplicateOutcome<TDefinition> | null>;
}

export interface ContentDuplicateTranslationSource {
  findManyRowsForItem: (
    itemId: ContentId,
    options?: { tx?: ContentDatabase },
  ) => Promise<{ languageId: number; locale: string; values: object }[]>;
  resolveLanguage: (
    locale: string,
    options?: { requireEnabled?: boolean; tx?: ContentDatabase },
  ) => Promise<ContentLanguage>;
}

export interface ContentDuplicateDependencies {
  advanced?: ContentAdvancedStore;
  c: Context;
  columns: Record<string, PgColumn>;
  definition: AnyContentTypeDefinition;
  pluginId?: string;
  table: PgTable;
  translation?: {
    columns: Record<string, PgColumn>;
    model: () => ContentDuplicateTranslationSource;
    table: PgTable;
  };
}

export interface ContentDuplicateWriter<TBase, TTranslation> {
  base: (
    values: Record<string, unknown>,
    tx: ContentDatabase,
  ) => Promise<TBase>;
  idOf: (base: TBase) => ContentId;
  translation: (
    itemId: ContentId,
    locale: string,
    values: Record<string, unknown>,
    tx: ContentDatabase,
  ) => Promise<TTranslation>;
}

interface SlugPlan {
  base: string;
  field: string;
  history: boolean;
  maxLength: number;
}

interface SlugScope {
  languageId: null | number;
  locale: null | string;
}

type Values = Record<string, unknown>;

const isRecord = (value: unknown): value is Values =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const pickLeaves = (inner: ContentFieldMap, value: Values): Values =>
  Object.fromEntries(
    Object.entries(inner)
      .filter(([leaf]) => value[leaf] !== undefined)
      .map(([leaf, leafValue]) => [leaf, toInput(leafValue, value[leaf])]),
  );

const toInput = (
  fieldValue: ContentFieldDescriptor,
  value: unknown,
): unknown => {
  if (value === null || value === undefined) return value;

  switch (fieldValue.kind) {
    case "dateTime":
      return value instanceof Date ? value.toISOString() : value;
    case "group":
      return isRecord(value)
        ? pickLeaves(contentInnerFields(fieldValue), value)
        : value;
    case "repeatable":
      return Array.isArray(value)
        ? value.map(row =>
            isRecord(row)
              ? pickLeaves(contentInnerFields(fieldValue), row)
              : row,
          )
        : value;
    default:
      return Array.isArray(value) ? [...(value as unknown[])] : value;
  }
};

const copyValues = (fields: ContentFieldMap, values: Values): Values =>
  Object.fromEntries(
    Object.entries(fields)
      .filter(([name]) => values[name] !== undefined)
      .map(([name, fieldValue]) => [name, toInput(fieldValue, values[name])]),
  );

const applyOverrides = (
  fields: ContentFieldMap,
  copied: Values,
  overrides: Values,
): Values => {
  const next = { ...copied };

  for (const [name, value] of Object.entries(overrides)) {
    if (value === undefined) continue;
    const fieldValue = fields[name] as ContentFieldDescriptor | undefined;

    if (fieldValue?.kind === "group" && isRecord(value)) {
      const current = next[name];
      next[name] = { ...(isRecord(current) ? current : {}), ...value };
      continue;
    }

    if (fieldValue?.kind === "repeatable" && Array.isArray(value)) {
      next[name] = value.map(row =>
        isRecord(row)
          ? Object.fromEntries(
              Object.entries(row).filter(([key]) => key !== "id"),
            )
          : row,
      );
      continue;
    }

    next[name] = value;
  }

  return next;
};

export const appendContentTitleSuffix = (
  title: string,
  suffix: string,
  maxLength?: number,
): string => {
  const tail = ` ${suffix}`;
  if (maxLength === undefined || title.length + tail.length <= maxLength) {
    return `${title}${tail}`;
  }

  const budget = maxLength - tail.length;
  if (budget <= 0) return `${title}${tail}`.slice(0, maxLength);

  let kept = "";
  for (const point of title) {
    if (kept.length + point.length > budget) break;
    kept += point;
  }

  return `${kept.trimEnd()}${tail}`;
};

export const contentSlugCandidate = (
  base: string,
  position: number,
  maxLength: number,
): string => {
  if (position <= 1) return base.slice(0, maxLength).replace(/-+$/, "");

  const tail = `-${position}`;
  const head = base
    .slice(0, Math.max(maxLength - tail.length, 0))
    .replace(/-+$/, "");

  return head === "" ? tail.slice(1) : `${head}${tail}`;
};

const sameValue = (left: unknown, right: unknown): boolean => {
  if (left instanceof Date || right instanceof Date) {
    return (
      new Date(left as Date | string).getTime() ===
      new Date(right as Date | string).getTime()
    );
  }

  return left === right;
};

export const runContentDuplicate = async <TBase, TTranslation>(
  {
    advanced,
    c,
    columns,
    definition,
    pluginId,
    table,
    translation,
  }: ContentDuplicateDependencies,
  sourceId: ContentId,
  options: {
    overrides?: object;
    translations?: Partial<Record<string, object>>;
    tx?: ContentDatabase;
  },
  writer: ContentDuplicateWriter<TBase, TTranslation>,
): Promise<null | {
  base: TBase;
  skippedLocales: string[];
  translations: TTranslation[];
}> => {
  const contentTypeId = definition.id;

  if (!definition.duplication.enabled) {
    throw new ContentEngineError(
      "duplicate needs `duplication: { enabled: true }` on the content type.",
      { contentTypeId },
    );
  }

  const localized = definition.localization.enabled;
  if (localized && !translation) {
    throw new ContentEngineError(
      "A localized content type duplicates its translations too, so the service needs the translation model. Use `model.service(c)` rather than building the service by hand.",
      { contentTypeId },
    );
  }

  const id = parseContentId(definition.idStrategy, sourceId);
  if (id === null) return null;
  const { localizedFields, sharedFields, collectionFields } =
    partitionContentFields(definition.fields);
  const writableFields: ContentFieldMap = {
    ...sharedFields,
    ...collectionFields,
  };
  const storage = contentStorageColumns(sharedFields);
  const titleField = definition.duplication.titleSuffixField;
  const deliverySlugField = definition.publicApi.enabled
    ? definition.publicApi.slugField
    : null;
  const slugHistory = contentSlugHistoryFor({
    c,
    definition,
    pluginId: pluginId ?? "",
  });

  const overrides = (options.overrides ?? {}) as Values;
  const localeOverrides = new Map<string, Values>();
  for (const [locale, values] of Object.entries(options.translations ?? {})) {
    if (values !== undefined) {
      localeOverrides.set(locale.toLowerCase(), values as Values);
    }
  }

  const suffixes = new Map<string, Promise<string>>();
  const titleSuffix = async (locale: string | undefined): Promise<string> => {
    const key = locale ?? "";
    let pending = suffixes.get(key);
    if (!pending) {
      pending = resolveContentTitleSuffix(c, locale);
      suffixes.set(key, pending);
    }

    return await pending;
  };

  const withTitleSuffix = async (
    fields: ContentFieldMap,
    values: Values,
    overridden: Values,
    locale: string | undefined,
  ): Promise<Values> => {
    if (titleField === null || !(titleField in fields)) return values;
    if (overridden[titleField] !== undefined) return values;

    const title = values[titleField];
    if (typeof title !== "string" || title.trim() === "") return values;

    const { maxLength } = fields[titleField] as { maxLength?: number };

    return {
      ...values,
      [titleField]: appendContentTitleSuffix(
        title,
        await titleSuffix(locale),
        maxLength,
      ),
    };
  };

  const slugPlans = (
    fields: ContentFieldMap,
    values: Values,
    source: Values,
    overridden: Values,
  ): SlugPlan[] =>
    Object.entries(fields)
      .filter(
        ([name, fieldValue]) =>
          fieldValue.kind === "slug" && overridden[name] === undefined,
      )
      .map(([name, fieldValue]) => {
        const { maxLength = CONTENT_SLUG_DEFAULT_LENGTH, source: from } =
          fieldValue as { maxLength?: number; source?: string };
        const derived =
          from !== undefined && typeof values[from] === "string"
            ? slugify(values[from], maxLength)
            : "";
        const current = typeof source[name] === "string" ? source[name] : "";

        return {
          base:
            derived !== ""
              ? derived
              : slugify(
                  current === ""
                    ? CONTENT_DUPLICATE_SLUG_SUFFIX
                    : `${current}-${CONTENT_DUPLICATE_SLUG_SUFFIX}`,
                  maxLength,
                ),
          field: name,
          history: slugHistory !== null && name === deliverySlugField,
          maxLength,
        };
      });

  const chooseSlug = async (
    tx: ContentDatabase,
    plan: SlugPlan,
    scope: SlugScope,
    excluded: ReadonlySet<string>,
  ): Promise<string> => {
    const candidates = [
      ...new Set(
        Array.from({ length: CONTENT_DUPLICATE_SLUG_CANDIDATES }, (_, index) =>
          contentSlugCandidate(plan.base, index + 1, plan.maxLength),
        ),
      ),
    ].filter(candidate => candidate !== "" && !excluded.has(candidate));

    const { languageId } = scope;
    const target =
      languageId !== null && translation
        ? {
            column: translation.columns[plan.field],
            scope: eq(translation.columns.languageId, languageId),
            table: translation.table,
          }
        : { column: columns[plan.field], scope: undefined, table };
    const rows =
      candidates.length > 0
        ? await tx
            .select({ slug: target.column })
            .from(target.table)
            .where(and(target.scope, inArray(target.column, candidates)))
        : [];
    const live = new Set(rows.map(row => String(row.slug)));

    for (const candidate of candidates) {
      if (live.has(candidate)) continue;
      if (
        plan.history &&
        slugHistory &&
        (await slugHistory.owner(
          { languageId: scope.languageId, slug: candidate },
          tx,
        )) !== null
      ) {
        continue;
      }

      return candidate;
    }

    throw new ContentDuplicateSlugConflict({
      contentTypeId,
      field: plan.field,
      locale: scope.locale,
      slug: candidates.at(-1) ?? plan.base,
    });
  };

  const collidedSlug = (
    error: unknown,
    plans: readonly SlugPlan[],
    scope: SlugScope,
  ): string | undefined => {
    if (pgErrorCode(error) !== PG_ERROR_CODES.uniqueViolation) return undefined;

    const constraint = pgConstraintName(error);
    if (constraint === undefined) return plans[0]?.field;

    const indexes =
      scope.languageId === null
        ? definition.indexes
        : definition.localization.translationIndexes;

    return plans.find(plan =>
      indexes.some(
        index =>
          index.unique &&
          index.name === constraint &&
          index.on.at(-1) === plan.field,
      ),
    )?.field;
  };

  const writeWithSlugs = async <TResult>(
    tx: ContentDatabase,
    plans: readonly SlugPlan[],
    scope: SlugScope,
    write: (db: ContentDatabase, slugs: Values) => Promise<TResult>,
  ): Promise<TResult> => {
    const excluded = new Map<string, Set<string>>();

    for (let attempt = 1; ; attempt += 1) {
      const slugs: Record<string, string> = {};
      for (const plan of plans) {
        slugs[plan.field] = await chooseSlug(
          tx,
          plan,
          scope,
          excluded.get(plan.field) ?? new Set(),
        );
      }

      if (plans.length === 0) return await write(tx, slugs);

      try {
        return await tx.transaction(
          async savepoint => await write(savepoint, slugs),
        );
      } catch (error) {
        const field = collidedSlug(error, plans, scope);
        if (field === undefined) throw error;

        if (attempt >= CONTENT_DUPLICATE_SLUG_ATTEMPTS) {
          throw new ContentDuplicateSlugConflict({
            contentTypeId,
            field,
            locale: scope.locale,
            slug: slugs[field],
          });
        }

        const taken = excluded.get(field) ?? new Set<string>();
        taken.add(slugs[field]);
        excluded.set(field, taken);
      }
    }
  };

  const missingUniqueOverrides = (raw: Values, copy: Values): string[] => {
    const regenerated = new Set(
      Object.entries(sharedFields)
        .filter(
          ([name, fieldValue]) =>
            fieldValue.kind === "slug" && overrides[name] === undefined,
        )
        .map(([name]) => name),
    );
    const written = contentValuesToColumns(sharedFields, copy);
    const pathOf = new Map(
      definition.advanced.leaves.map(leaf => [leaf.columnName, leaf.path]),
    );
    const fields = new Set<string>();

    for (const index of definition.indexes) {
      if (!index.unique) continue;
      if (index.on.some(column => regenerated.has(column))) continue;
      if (!index.on.every(column => column in storage)) continue;
      if (index.on.some(column => raw[column] === null)) continue;
      if (!index.on.every(column => sameValue(written[column], raw[column]))) {
        continue;
      }

      for (const column of index.on) fields.add(pathOf.get(column) ?? column);
    }

    return [...fields];
  };

  const transact = async <TResult>(
    body: (tx: ContentDatabase) => Promise<TResult>,
  ): Promise<TResult> =>
    options.tx
      ? await body(options.tx)
      : await c.get("db").transaction(async tx => await body(tx));

  return await transact(async tx => {
    const [raw] = await tx
      .select({
        id: columns.id,
        ...Object.fromEntries(
          Object.keys(storage).map(name => [name, columns[name]]),
        ),
      })
      .from(table)
      .where(eq(columns.id, id))
      .limit(1)
      .for("share");
    if (!raw) return null;

    if (translation) {
      await tx
        .select({ itemId: translation.columns.itemId })
        .from(translation.table)
        .where(eq(translation.columns.itemId, id))
        .for("share");
    }

    const source: Values = {
      ...contentColumnsToValues(sharedFields, raw),
      ...(advanced?.enabled ? await advanced.load(id, tx) : {}),
    };
    const sourceTranslations = translation
      ? await translation.model().findManyRowsForItem(id, { tx })
      : [];

    const sourceLocales = new Set(
      sourceTranslations.map(row => row.locale.toLowerCase()),
    );
    const unknownLocale = [...localeOverrides.keys()].find(
      locale => !sourceLocales.has(locale),
    );
    if (unknownLocale !== undefined) {
      throw new ContentInputError(
        `The source has no "${unknownLocale}" translation, so there is nothing to override in that language.`,
        { contentTypeId },
      );
    }

    const copied = await withTitleSuffix(
      sharedFields,
      applyOverrides(
        writableFields,
        copyValues(writableFields, source),
        overrides,
      ),
      overrides,
      localized ? definition.localization.defaultLocale : undefined,
    );

    const unique = missingUniqueOverrides(raw, copied);
    if (unique.length > 0) {
      throw new ContentDuplicateUniqueRequired({
        contentTypeId,
        fields: unique,
      });
    }

    const base = await writeWithSlugs(
      tx,
      slugPlans(sharedFields, copied, source, overrides),
      { languageId: null, locale: null },
      async (db, slugs) => await writer.base({ ...copied, ...slugs }, db),
    );
    const itemId = writer.idOf(base);

    const isDefault = (locale: string): boolean =>
      locale.toLowerCase() ===
      definition.localization.defaultLocale.toLowerCase();
    const ordered = [...sourceTranslations].sort((left, right) =>
      isDefault(left.locale) ? -1 : isDefault(right.locale) ? 1 : 0,
    );

    const translations: TTranslation[] = [];
    const skippedLocales: string[] = [];

    for (const row of ordered) {
      const language = await translation?.model().resolveLanguage(row.locale, {
        tx,
      });
      if (language?.isEnabled === false) {
        skippedLocales.push(row.locale);
        continue;
      }

      const sourceValues = row.values as Values;
      const localeOverride =
        localeOverrides.get(row.locale.toLowerCase()) ?? {};
      const values = await withTitleSuffix(
        localizedFields,
        applyOverrides(
          localizedFields,
          copyValues(localizedFields, sourceValues),
          localeOverride,
        ),
        localeOverride,
        row.locale,
      );

      translations.push(
        await writeWithSlugs(
          tx,
          slugPlans(localizedFields, values, sourceValues, localeOverride),
          { languageId: row.languageId, locale: row.locale },
          async (db, slugs) =>
            await writer.translation(
              itemId,
              row.locale,
              { ...values, ...slugs },
              db,
            ),
        ),
      );
    }

    return { base, skippedLocales, translations };
  });
};

export const resolveContentTitleSuffix = async (
  c: Context,
  locale: string | undefined,
): Promise<string> => {
  const i18n = c.get("i18n");
  const t = await i18n.getTranslator(i18n.resolveSupportedLocale(locale));
  if (!t.has(CONTENT_DUPLICATE_TITLE_SUFFIX_KEY)) {
    return CONTENT_DUPLICATE_TITLE_SUFFIX;
  }

  return (
    t(CONTENT_DUPLICATE_TITLE_SUFFIX_KEY).trim() ||
    CONTENT_DUPLICATE_TITLE_SUFFIX
  );
};

export const duplicationMethods = <TMethods>(
  definition: AnyContentTypeDefinition,
  service: object,
): TMethods => {
  if (
    !definition.duplication.enabled ||
    typeof (service as { duplicate?: unknown }).duplicate !== "function"
  ) {
    throw new ContentEngineError(
      "duplicate needs `duplication: { enabled: true }` on the content type.",
      { contentTypeId: definition.id },
    );
  }

  return service as TMethods;
};
