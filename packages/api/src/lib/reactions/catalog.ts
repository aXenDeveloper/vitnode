import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import { and, asc, eq, inArray } from "drizzle-orm";

import { defineCacheEntry } from "@/builders";
import { core_files } from "@/database/files";
import { core_languages_words } from "@/database/languages";
import { core_reactions, core_reactions_roles } from "@/database/reactions";

import { REACTION_KINDS, REACTION_WORDS } from "./const";

const multiLangSchema = z.array(
  z.object({ languageCode: z.string(), value: z.string() }),
);

/** An uploaded reaction image, as the browser shows it. Browser-safe shape. */
export const reactionImageSchema = z.object({
  animated: z.boolean(),
  height: z.number().int().nullable(),
  /** Static first frame of an animated image, for reduced motion. */
  posterUrl: z.string().nullable(),
  url: z.string(),
  width: z.number().int().nullable(),
});

/** One reaction in the catalog, with everything the server decides with. */
export const reactionCatalogEntrySchema = z.object({
  allRoles: z.boolean(),
  code: z.string(),
  enabled: z.boolean(),
  fileId: z.number().int().nullable(),
  icon: z.string().nullable(),
  id: z.number().int(),
  image: reactionImageSchema.nullable(),
  kind: z.enum(REACTION_KINDS),
  points: z.number().int(),
  position: z.number().int(),
  posterFileId: z.number().int().nullable(),
  roles: z.array(
    z.object({
      dailyLimit: z.number().int().nullable(),
      roleId: z.number().int(),
    }),
  ),
  title: multiLangSchema,
});

export type ReactionCatalogEntry = z.infer<typeof reactionCatalogEntrySchema>;

const reactionCatalogCache = defineCacheEntry({
  name: "reactions.catalog",
  version: 1,
  schema: z.array(reactionCatalogEntrySchema),
  ttlSeconds: 60 * 60,
});

const numberOrNull = (value: unknown): null | number =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const loadCatalog = async (c: Context): Promise<ReactionCatalogEntry[]> => {
  const db = c.get("db");
  const rows = await db
    .select()
    .from(core_reactions)
    .orderBy(asc(core_reactions.position), asc(core_reactions.id));
  if (rows.length === 0) return [];

  const ids = rows.map(row => row.id);
  const fileIds = rows.flatMap(row =>
    [row.fileId, row.posterFileId].filter((id): id is number => id !== null),
  );

  const files =
    fileIds.length > 0
      ? await db
          .select({
            id: core_files.id,
            key: core_files.key,
            metadata: core_files.metadata,
          })
          .from(core_files)
          .where(inArray(core_files.id, fileIds))
      : [];
  const [roleRows, words] = await Promise.all([
    db
      .select()
      .from(core_reactions_roles)
      .where(inArray(core_reactions_roles.reactionId, ids)),
    db
      .select({
        itemId: core_languages_words.itemId,
        languageCode: core_languages_words.languageCode,
        value: core_languages_words.value,
      })
      .from(core_languages_words)
      .where(
        and(
          eq(core_languages_words.pluginCode, REACTION_WORDS.pluginCode),
          eq(core_languages_words.tableName, REACTION_WORDS.tableName),
          eq(core_languages_words.variable, "title"),
          inArray(core_languages_words.itemId, ids),
        ),
      ),
  ]);

  const storage = c.get("storage");
  const fileById = new Map(files.map(file => [file.id, file]));
  const urlOf = (id: null | number): null | string => {
    const file = id === null ? undefined : fileById.get(id);

    return file ? storage.getUrl(file.key) : null;
  };

  return rows.map(row => {
    const file = row.fileId === null ? undefined : fileById.get(row.fileId);
    const url = urlOf(row.fileId);

    return {
      allRoles: row.allRoles,
      code: row.code,
      enabled: row.enabled,
      fileId: row.fileId,
      icon: row.icon,
      id: row.id,
      image:
        row.kind === "image" && file && url
          ? {
              animated: file.metadata.animated === true,
              height: numberOrNull(file.metadata.height),
              posterUrl: urlOf(row.posterFileId),
              url,
              width: numberOrNull(file.metadata.width),
            }
          : null,
      kind: row.kind,
      points: row.points,
      position: row.position,
      posterFileId: row.posterFileId,
      roles: roleRows
        .filter(role => role.reactionId === row.id)
        .map(role => ({ dailyLimit: role.dailyLimit, roleId: role.roleId })),
      title: words
        .filter(word => word.itemId === row.id)
        .map(word => ({ languageCode: word.languageCode, value: word.value })),
    };
  });
};

/**
 * Every reaction, enabled or not, in display order, with titles, images and
 * role rules. Cached for an hour and dropped on every AdminCP change.
 * Server-only.
 */
export const getReactionCatalog = async (
  c: Context,
): Promise<ReactionCatalogEntry[]> =>
  await c
    .get("cache")
    .entry(reactionCatalogCache)
    .remember(async () => await loadCatalog(c));

/** Drops the cached catalog; call it after any change to reactions or their roles. */
export const forgetReactionCatalog = async (c: Context): Promise<void> => {
  await c.get("cache").entry(reactionCatalogCache).delete();
};
