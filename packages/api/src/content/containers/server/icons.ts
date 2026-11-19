import type { Context } from "hono";

import { and, eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import type { AnyContentContainerDefinition } from "../types";

import { core_files } from "../../../database/files";
import { storageUrlOf } from "../../../lib/storage-url";
import { contentFileFolder } from "../../files";
import {
  contentContainerIconFields,
  parseContentContainerIcon,
  serializeContentContainerIcon,
} from "../icon";

interface IconScope {
  definition: AnyContentContainerDefinition;
  pluginId: string;
}

export const contentContainerIconFieldNames = (
  definition: AnyContentContainerDefinition,
): string[] => contentContainerIconFields(definition).map(([name]) => name);

export const contentContainerIconFolder = ({
  definition,
  pluginId,
}: IconScope): string =>
  `${contentFileFolder({ module: definition.admin.permissionModule, pluginId })}/icons`;

export const contentContainerIconFileMetadata = (
  definition: AnyContentContainerDefinition,
  field: string,
): Record<string, string> => ({
  containerDefinitionId: definition.id,
  containerField: field,
});

const uploadedIcons = async (
  c: Context,
  { definition, pluginId }: IconScope,
): Promise<Map<string, number>> => {
  const rows = await c
    .get("db")
    .select({ id: core_files.id, key: core_files.key })
    .from(core_files)
    .where(
      and(
        eq(core_files.pluginId, pluginId),
        sql`${core_files.metadata} @> ${JSON.stringify({ containerDefinitionId: definition.id })}::jsonb`,
      ),
    );

  return new Map(
    rows.flatMap(row => {
      const url = storageUrlOf(c, row.key);

      return url ? [[url, row.id] as const] : [];
    }),
  );
};

const imageUrlOf = (value: unknown): null | string => {
  if (typeof value !== "string") return null;
  const parsed = parseContentContainerIcon(value);

  return parsed?.type === "image" ? parsed.value : null;
};

export const contentContainerIconImages = (
  definition: AnyContentContainerDefinition,
  metadata: Record<string, unknown>,
): string[] =>
  contentContainerIconFieldNames(definition).flatMap(name => {
    const url = imageUrlOf(metadata[name]);

    return url ? [url] : [];
  });

export const normalizeContentContainerIcons = async (
  c: Context,
  scope: IconScope,
  {
    metadata,
    previous,
    refuse,
  }: {
    metadata: Record<string, unknown>;
    previous: Record<string, unknown>;
    refuse: (message: string) => never;
  },
): Promise<Record<string, unknown>> => {
  const names = contentContainerIconFieldNames(scope.definition);
  if (names.length === 0) return metadata;

  let uploaded: Map<string, number> | undefined;
  const normalized = { ...metadata };

  for (const name of names) {
    const raw = metadata[name];
    if (raw === undefined) continue;
    if (raw === null || (typeof raw === "string" && raw.trim() === "")) {
      normalized[name] = null;
      continue;
    }

    const parsed =
      typeof raw === "string" ? parseContentContainerIcon(raw) : undefined;
    if (!parsed) return refuse(`"${name}" is not a valid icon.`);

    if (
      parsed.type === "image" &&
      imageUrlOf(previous[name]) !== parsed.value
    ) {
      uploaded ??= await uploadedIcons(c, scope);
      if (!uploaded.has(parsed.value)) {
        return refuse(
          `"${name}" points at an image that was not uploaded for this collection.`,
        );
      }
    }

    normalized[name] = serializeContentContainerIcon(parsed);
  }

  return normalized;
};

export const discardContentContainerIcons = async (
  c: Context,
  scope: IconScope,
  urls: readonly string[],
  stillUsed: ReadonlySet<string>,
): Promise<void> => {
  const orphaned = urls.filter(url => !stillUsed.has(url));
  if (orphaned.length === 0) return;

  const uploaded = await uploadedIcons(c, scope);
  for (const url of orphaned) {
    const fileId = uploaded.get(url);
    if (fileId === undefined) continue;

    try {
      await c.get("storage").deleteFile(fileId, { force: true });
    } catch (error) {
      if (!(error instanceof HTTPException)) throw error;
    }
  }
};
