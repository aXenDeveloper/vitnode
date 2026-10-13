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

/**
 * Resolves the container a write names, on the server, inside the write's own
 * transaction.
 *
 * The id came from a client, so it proves nothing: the row is read back and its
 * collection compared with the one the content type's field declares. The
 * foreign key already guarantees existence at commit; this is what guarantees
 * the *right* collection, which no constraint can express - and it is the
 * context a later per-container publishing policy reads.
 *
 * `undefined` means the write does not touch the container; `null` means it
 * clears it (the schema only lets that through for an optional field).
 */
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
    // A concurrent delete of this container waits for the write to commit, and
    // then fails on the RESTRICT foreign key rather than racing past the check.
    .for("share");

  if (!row) throw refuse("CONTAINER_NOT_FOUND");
  if (row.definitionId !== container.field.definition.id) {
    throw refuse("CONTAINER_DEFINITION_MISMATCH");
  }

  return row;
};
