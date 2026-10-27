import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Context } from "hono";

import { and, eq, inArray } from "drizzle-orm";

import type {
  ModerationCaptureResult,
  ModerationReportTargetDefinition,
  ModerationTargetActionDefinition,
  ModerationTargetState,
} from "../../api/lib/moderation/targets";
import type {
  ModerationSnapshotField,
  ModerationSnapshotFile,
} from "../../lib/moderation/snapshot";
import type { ContentId } from "../ids";
import type { AnyContentTypeDefinition } from "../types";
import type { ContentVisibilityAction } from "../visibility";
import type { ContentEditorialOutcome } from "./editorial-service";
import type { AnyContentModel } from "./model";
import type { ContentDatabase } from "./service";

import { core_files } from "../../database/files";
import { core_users } from "../../database/users";
import { MODERATION_PERMISSIONS } from "../../lib/moderation/const";
import { contentI18nKeys } from "../admin/labels";
import { contentDeliveryPublicUrl } from "../delivery";
import { contentIdKey, parseContentId } from "../ids";
import { contentPublicHref } from "../public-url";
import { isRichTextDocument } from "../rich-text/document";
import { richTextToPlainText } from "../rich-text/plain-text";
import { contentSearchUrl } from "../search";
import { isContentHidden } from "../visibility";
import { resolveContentActor } from "./actor";
import { contentAuthorIds } from "./hidden-access";
import { findContentLanguage } from "./language-resolver";
import { contentLocaleRouting } from "./locale-routing";
import { contentDefinitionOf } from "./model";
import { editorialVisibilityMethods, visibilityMethods } from "./visibility";
import { contentVisibilityEffects } from "./visibility-effects";

const withDatabase = (c: Context, db: ContentDatabase): Context =>
  new Proxy(c, {
    get(target, property) {
      if (property === "get") {
        return (key: string) =>
          key === "db" ? db : (target.get as (k: string) => unknown)(key);
      }
      const value: unknown = Reflect.get(target, property, target);

      return typeof value === "function" ? value.bind(target) : value;
    },
  });

const toIso = (value: unknown): null | string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value !== "") {
    const parsed = new Date(value);

    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  return null;
};

const latestIso = (...values: unknown[]): null | string =>
  values
    .map(toIso)
    .filter((value): value is string => value !== null)
    .sort()
    .at(-1) ?? null;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const resolveFiles = async (
  db: ContentDatabase,
  value: unknown,
): Promise<ModerationSnapshotFile[]> => {
  const values = (Array.isArray(value) ? value : [value]).filter(
    item => item !== null && item !== undefined,
  );
  const ids = values.filter(
    (item): item is number => typeof item === "number" && item > 0,
  );
  const rows = ids.length
    ? await db
        .select({
          id: core_files.id,
          mimeType: core_files.mimeType,
          name: core_files.name,
          size: core_files.size,
        })
        .from(core_files)
        .where(inArray(core_files.id, ids))
    : [];

  return values.flatMap((item): ModerationSnapshotFile[] => {
    if (typeof item === "number") {
      const row = rows.find(file => file.id === item);

      return [
        {
          id: item,
          mimeType: row?.mimeType ?? null,
          name: row?.name ?? null,
          size: row?.size ?? null,
          url: null,
        },
      ];
    }
    if (isRecord(item)) {
      return [
        {
          id:
            typeof item.id === "number" || typeof item.id === "string"
              ? item.id
              : null,
          mimeType: typeof item.mimeType === "string" ? item.mimeType : null,
          name: typeof item.name === "string" ? item.name : null,
          size: typeof item.size === "number" ? item.size : null,
          url: typeof item.url === "string" ? item.url : null,
        },
      ];
    }

    return [];
  });
};

const snapshotValue = async (
  db: ContentDatabase,
  kind: string,
  value: unknown,
): Promise<Omit<ModerationSnapshotField, "label" | "name">> => {
  switch (kind) {
    case "dateTime":
      return { kind: "value", value: toIso(value) };
    case "file":
      return { kind: "file", value: await resolveFiles(db, value) };
    case "richText":
      return {
        kind: "richText",
        value: isRichTextDocument(value) ? value : null,
      };
    case "slug":
    case "text":
    case "textarea":
      return { kind: "text", value: typeof value === "string" ? value : null };
    default:
      return {
        kind: "value",
        value:
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean"
            ? value
            : null,
      };
  }
};

const REPORT_TITLE_EXCERPT_LENGTH = 120;

const reportTitleOf = (value: unknown): null | string => {
  if (typeof value === "string") return value;
  if (!isRichTextDocument(value)) return null;

  const text = richTextToPlainText(value).replace(/\s+/g, " ").trim();
  if (text === "") return null;

  return text.length > REPORT_TITLE_EXCERPT_LENGTH
    ? `${text.slice(0, REPORT_TITLE_EXCERPT_LENGTH - 1).trimEnd()}…`
    : text;
};

const contentUrlOf = (
  c: Context,
  definition: AnyContentTypeDefinition,
  { locale, slug }: { locale: null | string; slug: unknown },
): null | string => {
  if (typeof slug !== "string" || slug === "") return null;
  const routing = contentLocaleRouting(c);
  const language = locale ?? definition.localization.defaultLocale;

  if (definition.delivery.enabled) {
    const url = contentDeliveryPublicUrl({
      definition,
      locale: language,
      routing,
      slug,
    });

    return url ? contentPublicHref(url) : null;
  }

  return contentSearchUrl({
    definition,
    locale: definition.localization.enabled ? language : undefined,
    routing,
    slug,
  });
};

const readBaseRow = async (
  db: ContentDatabase,
  model: AnyContentModel,
  itemId: ContentId,
): Promise<null | Record<string, unknown>> => {
  const columns = model.columns as Record<string, PgColumn>;
  const table: PgTable = model.table;
  const [row] = await db
    .select()
    .from(table)
    .where(eq(columns.id, itemId))
    .limit(1);

  return row ?? null;
};

const readTranslationRow = async (
  c: Context,
  db: ContentDatabase,
  model: AnyContentModel,
  { itemId, locale }: { itemId: ContentId; locale: null | string },
): Promise<null | Record<string, unknown>> => {
  const translationTable = model.translationTable as null | PgTable;
  const translationColumns = model.translationColumns as null | Record<
    string,
    PgColumn
  >;
  if (!translationTable || !translationColumns || !locale) return null;

  const language = await findContentLanguage(c, locale, db);
  if (!language) return null;

  const [row] = await db
    .select()
    .from(translationTable)
    .where(
      and(
        eq(translationColumns.itemId, itemId),
        eq(translationColumns.languageId, language.id),
      ),
    )
    .limit(1);

  return row ?? null;
};

const authorsOf = async (
  c: Context,
  db: ContentDatabase,
  model: AnyContentModel,
  itemId: ContentId,
): Promise<{ id: number; name: string }[]> => {
  const ids = await contentAuthorIds(withDatabase(c, db), model, itemId);
  if (ids.length === 0) return [];

  const users = await db
    .select({ id: core_users.id, name: core_users.name })
    .from(core_users)
    .where(inArray(core_users.id, ids));

  return ids.flatMap(id => users.filter(user => user.id === id));
};

const captureContent = async (
  c: Context,
  model: AnyContentModel,
  pluginId: string,
  { locale, targetId }: { locale: null | string; targetId: string },
): Promise<ModerationCaptureResult | null> => {
  const definition = contentDefinitionOf(model);
  const itemId = parseContentId(definition.idStrategy, targetId);
  if (itemId === null || !model.publicService) return null;

  const labels = contentI18nKeys(definition, pluginId);
  const localized = definition.localization.enabled;

  return await c.get("db").transaction(
    async (tx: ContentDatabase) => {
      const scoped = withDatabase(c, tx);
      const visible = (await model
        .publicService?.(scoped)
        .findById(itemId, localized && locale ? { locale } : {})) as
        | null
        | Record<string, unknown>
        | undefined;
      if (!visible) return null;

      const servedLocale =
        localized && typeof visible.locale === "string" ? visible.locale : null;
      const base = await readBaseRow(tx, model, itemId);
      if (!base) return null;
      const translation = await readTranslationRow(c, tx, model, {
        itemId,
        locale: servedLocale,
      });

      const valueOf = (name: string): unknown => {
        const descriptor = definition.fields[name];
        if (descriptor?.kind === "file" && name in visible) {
          return visible[name];
        }

        return "localized" in (descriptor ?? {}) &&
          (descriptor as { localized?: boolean }).localized
          ? translation?.[name]
          : base[name];
      };

      const advanced = model.advanced.fields.filter((name: string) =>
        definition.reports.snapshotFields.includes(name),
      );
      const advancedValues = advanced.length
        ? await model.advanced.load(itemId, tx, advanced)
        : {};

      const fields: ModerationSnapshotField[] = [];
      for (const name of definition.reports.snapshotFields) {
        const descriptor = definition.fields[name];
        if (!descriptor) continue;
        const value =
          name in advancedValues && !(name in visible)
            ? advancedValues[name]
            : valueOf(name);
        fields.push({
          label: labels.field(name),
          name,
          ...(await snapshotValue(tx, descriptor.kind, value)),
        } as ModerationSnapshotField);
      }

      const titleField = definition.reports.titleField;
      const title = titleField ? reportTitleOf(valueOf(titleField)) : null;
      const slug = definition.publicApi.enabled
        ? (visible[definition.publicApi.slugField] ?? null)
        : null;
      const scopeColumn = model.moderationScope?.column;
      const rawScope = scopeColumn ? base[scopeColumn] : null;
      const scopeValue =
        typeof rawScope === "number" || typeof rawScope === "string"
          ? String(rawScope)
          : null;

      return {
        authors: await authorsOf(c, tx, model, itemId),
        fields,
        locale: {
          fallback:
            localized &&
            locale !== null &&
            servedLocale !== null &&
            servedLocale.toLowerCase() !== locale.toLowerCase(),
          requested: localized ? locale : null,
          served: servedLocale,
        },
        scope:
          model.moderationScope && scopeValue !== null
            ? { family: model.moderationScope.family, id: scopeValue }
            : null,
        source: {
          publishedAt: toIso(translation?.publishedAt ?? base.publishedAt),
          updatedAt: latestIso(base.updatedAt, translation?.updatedAt),
          version: typeof base.version === "number" ? base.version : null,
        },
        title,
        url: contentUrlOf(c, definition, { locale: servedLocale, slug }),
      };
    },
    { accessMode: "read only", isolationLevel: "repeatable read" },
  );
};

const currentContent = async (
  c: Context,
  model: AnyContentModel,
  { locale, targetId }: { locale: null | string; targetId: string },
): Promise<ModerationTargetState | null> => {
  const definition = contentDefinitionOf(model);
  const itemId = parseContentId(definition.idStrategy, targetId);
  if (itemId === null) return null;

  const db = c.get("db");
  const base = await readBaseRow(db, model, itemId);
  if (!base) return null;

  const slugField = definition.publicApi.enabled
    ? definition.publicApi.slugField
    : null;
  let slug: unknown = slugField ? base[slugField] : null;
  let servedLocale = locale;
  if (slugField && definition.localization.enabled) {
    const translation =
      (await readTranslationRow(c, db, model, { itemId, locale })) ??
      (await readTranslationRow(c, db, model, {
        itemId,
        locale: definition.localization.defaultLocale,
      }));
    slug = translation?.[slugField] ?? null;
    if (translation && !locale) {
      servedLocale = definition.localization.defaultLocale;
    }
  }

  return {
    hidden: definition.visibility.enabled && isContentHidden(base),
    url: contentUrlOf(c, definition, { locale: servedLocale, slug }),
  };
};

export const visibilityAction = (
  model: AnyContentModel,
  pluginId: string,
  action: ContentVisibilityAction,
): ModerationTargetActionDefinition => ({
  available: state => (action === "hide" ? !state.hidden : state.hidden),
  permission: MODERATION_PERMISSIONS.hide,
  run: async (c, { actorUserId, targetId, tx }) => {
    const definition = contentDefinitionOf(model);
    const itemId = parseContentId(definition.idStrategy, targetId);
    if (itemId === null) return null;

    let outcome: ContentEditorialOutcome<AnyContentTypeDefinition>;
    if (definition.editorial.enabled && model.editorialService) {
      const actor = resolveContentActor(c);
      const result = await editorialVisibilityMethods(
        definition,
        model.editorialService(c, { pluginId }),
      )[action](itemId, {
        actor: { ...actor, userId: actor.userId ?? actorUserId },
        tx,
      });
      if (!result) return null;
      outcome = result;
    } else {
      const result = await visibilityMethods(definition, model.service(c))[
        action
      ](itemId, { actorUserId, tx });
      if (!result) return null;
      outcome = {
        changed: result.changed,
        changedFields: [],
        operation: action,
        previousSlug: null,
        restoredFromRevisionId: null,
        revisionId: null,
        row: result.row as ContentEditorialOutcome<AnyContentTypeDefinition>["row"],
        version: 0,
        visibility: result.visibility,
      };
    }

    return {
      changed: outcome.changed,
      effects: async () => {
        await contentVisibilityEffects(c, model, outcome, { pluginId });
      },
    };
  },
});

export const contentReportTarget = (
  model: AnyContentModel,
  pluginId: string,
): ModerationReportTargetDefinition => {
  const definition = contentDefinitionOf(model);
  const scope = model.moderationScope;
  const scopeColumn = scope?.column;

  return {
    actions: definition.visibility.enabled
      ? {
          hide: visibilityAction(model, pluginId, "hide"),
          unhide: visibilityAction(model, pluginId, "unhide"),
        }
      : undefined,
    capture: async (c, args) => await captureContent(c, model, pluginId, args),
    current: async (c, args) => await currentContent(c, model, args),
    label: contentI18nKeys(definition, pluginId).label,
    parseId: value => {
      const id = parseContentId(definition.idStrategy, value);

      return id === null ? null : contentIdKey(id);
    },
    permissionModule: definition.permissionModule,
    ...(scope && scopeColumn
      ? {
          resolveScope: async (c: Context, targetId: string) => {
            const id = parseContentId(definition.idStrategy, targetId);
            if (id === null) return undefined;
            const row = await readBaseRow(c.get("db"), model, id);
            if (!row) return undefined;
            const value = row[scopeColumn];

            return typeof value === "number" || typeof value === "string"
              ? String(value)
              : "";
          },
          scope: scope.family,
        }
      : {}),
    type: definition.id,
  };
};
