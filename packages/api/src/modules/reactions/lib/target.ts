import type { Context } from "hono";

import type { RegisteredReactionTarget } from "@/lib/reactions/targets";

import { findReactionTarget } from "@/lib/reactions/targets";

/** The registered target type a request names, or `undefined` for an unknown one. */
export const reactionTargetOf = (
  c: Context,
  { pluginId, type }: { pluginId: string; type: string },
): RegisteredReactionTarget | undefined =>
  findReactionTarget(c.get("core")?.reactions, { pluginId, type });

/** Parses a comma-separated id list with the target's `parseId`, deduplicated, in order. */
export const parseReactionIds = (
  registered: RegisteredReactionTarget,
  raw: string,
  max: number,
): string[] => {
  const ids = new Set<string>();
  for (const part of raw.split(",")) {
    const id = registered.definition.parseId(part.trim());
    if (id !== null) ids.add(id);
    if (ids.size >= max) break;
  }

  return [...ids];
};
