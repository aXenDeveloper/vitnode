import type { Context } from "hono";

import type { ContentId } from "../ids";
import type { AnyContentTypeDefinition } from "../types";

import { parseContentId } from "../ids";
import { canViewHiddenContentRecord } from "./hidden-access";

/** A thread root the current reader may open, from {@link resolveContentThreadRoot}. */
export interface ContentThreadRootAccess {
  /** `true` when the root is hidden and readable only to this reader. */
  hidden: boolean;
  rootId: ContentId;
  /** The content type the thread hangs off. */
  target: AnyContentTypeDefinition;
}

/** The content type a thread's `root` relation points at, if it has one. */
export const contentThreadTarget = (
  definition: AnyContentTypeDefinition,
): AnyContentTypeDefinition | undefined => {
  if (!definition.thread.enabled) return undefined;
  const rootField = definition.fields[definition.thread.rootField];

  return rootField?.kind === "relation" ? rootField.target() : undefined;
};

/**
 * Whether the current reader may open the thread of `definition` under
 * `root`: the root is published and visible, or hidden and readable to them
 * (an author, an editor or a moderator). The single rule behind `GET /thread`,
 * `GET /thread/branches` and live thread subscriptions. `null` for a missing,
 * malformed, unpublished or unreadable root - callers answer all of them the
 * same way, so none confirms that a draft exists. Server-only.
 */
export const resolveContentThreadRoot = async (
  c: Context,
  definition: AnyContentTypeDefinition,
  root: unknown,
): Promise<ContentThreadRootAccess | null> => {
  const target = contentThreadTarget(definition);
  if (!target) return null;

  const rootId = parseContentId(target.idStrategy, root);
  const rootService = (c.get("core")?.contentModels ?? [])
    .find(entry => entry.model.definition.id === target.id)
    ?.model.publicService?.(c);
  if (rootId === null || !rootService) return null;

  // An existence check: `select: []` reads the same published, visible row
  // without hydrating a single field of it.
  if (await rootService.findById(rootId, { select: [] })) {
    return { hidden: false, rootId, target };
  }

  const hidden = await rootService.findById(rootId, {
    hidden: true,
    select: [],
  });

  return hidden &&
    (await canViewHiddenContentRecord(c, {
      contentTypeId: target.id,
      itemId: rootId,
    }))
    ? { hidden: true, rootId, target }
    : null;
};
