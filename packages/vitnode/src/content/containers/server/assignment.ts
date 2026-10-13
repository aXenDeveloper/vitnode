import { eq } from "drizzle-orm";

import type { ContentDatabase } from "../../server/service";
import type { AnyContentTypeDefinition } from "../../types";

import { core_content_containers } from "../../../database/content-containers";
import {
  ContentContainerAssignmentError,
  contentContainerFieldOf,
} from "../association";

export interface ResolvedContentContainerContext {
  definitionId: string;
  id: number;
  parentId: null | number;
  pluginId: string;
  slug: string;
}

export const resolveContentContainerAssignment = async (
  tx: ContentDatabase,
  definition: AnyContentTypeDefinition,
  values: Record<string, unknown>,
): Promise<null | ResolvedContentContainerContext | undefined> => {
  const container = contentContainerFieldOf(definition);
  if (!container) return undefined;

  const value = values[container.name];
  if (value === undefined) return undefined;
  if (value === null) return null;

  const refuse = (
    code: ContentContainerAssignmentError["code"],
  ): ContentContainerAssignmentError =>
    new ContentContainerAssignmentError({
      code,
      contentTypeId: definition.id,
      field: container.name,
    });

  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw refuse("CONTAINER_NOT_FOUND");
  }

  const [row] = await tx
    .select({
      definitionId: core_content_containers.definitionId,
      id: core_content_containers.id,
      parentId: core_content_containers.parentId,
      pluginId: core_content_containers.pluginId,
      slug: core_content_containers.slug,
    })
    .from(core_content_containers)
    .where(eq(core_content_containers.id, value))
    .limit(1)
    .for("share");

  if (!row) throw refuse("CONTAINER_NOT_FOUND");
  if (row.definitionId !== container.field.definition.id) {
    throw refuse("CONTAINER_DEFINITION_MISMATCH");
  }

  return row;
};
