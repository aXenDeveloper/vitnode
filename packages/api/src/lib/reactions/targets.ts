import type { Context } from "hono";

import { MODERATION_IDENTIFIER_PATTERN } from "@/lib/moderation/const";

/** Thrown at startup when a reaction target is misconfigured. */
export class ReactionsRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReactionsRegistryError";
  }
}

/** What a target says about one id, for the current visitor. */
export interface ReactionTargetAccess {
  /** Who wrote it: blocks self reactions and collects reputation. */
  authorId: null | number;
  /** The visitor can read the target; `false` hides its reactions entirely. */
  canRead: boolean;
  /** `true` keeps the counts visible but stops new reactions (a locked topic). */
  locked?: boolean;
}

/** How a reaction's target looks in a user's timeline. */
export interface ReactionTargetPreview {
  context?: { title: string; url: null | string };
  /** i18n key naming the kind of thing, an ICU plural called with `count: 1`. */
  label: string;
  /** Plain text; cut to 200 characters. */
  title: string;
  url: string;
}

/**
 * Something members can react to that is not a Content Engine type (those
 * register their target automatically with `reactions: true`). Create it with
 * {@link defineReactionTarget} and register it in
 * `buildApiPlugin({ reactions: { targets } })`.
 *
 * How many reactions a member gives one item, which reactions they may use
 * and how many a day are role settings in the AdminCP, not target options.
 */
export interface ReactionTargetDefinition {
  /**
   * Access for a batch of ids `parseId` accepted, as the current visitor
   * (`c.get("user")`, `null` for guests). An id missing from the map is
   * unreadable. Called once per request, never per id. Server-only.
   */
  access: (
    c: Context,
    args: { ids: string[] },
  ) => Promise<Map<string, ReactionTargetAccess>>;
  /** Validates and normalizes a client-sent id before anything reads it; `null` rejects it. */
  parseId: (value: string) => null | string;
  /**
   * Title and link for timelines, for ids `access` already allowed. Without
   * it, reactions to this target never appear in timelines.
   */
  preview?: (
    c: Context,
    args: { ids: string[] },
  ) => Promise<Map<string, ReactionTargetPreview>>;
  /** Reactions move the author's reputation. Defaults to `true`. */
  reputation?: boolean;
  /** Stable id stored with every reaction, lowercase and dot-separated, e.g. `"forum.topic"`. */
  type: string;
}

export interface RegisteredReactionTarget {
  definition: ReactionTargetDefinition;
  pluginId: string;
}

/**
 * Validates a custom reaction target when the module loads. Server-only.
 *
 * @example
 * ```ts
 * import { defineReactionTarget } from "@vitnode/api/reactions";
 *
 * export const correctionReactionTarget = defineReactionTarget({
 *   type: "newsroom.correction",
 *   parseId: value => (/^[1-9]\d{0,9}$/.test(value) ? value : null),
 *   access: async (c, { ids }) =>
 *     new Map(ids.map(id => [id, { canRead: true, authorId: null }])),
 * });
 * ```
 *
 * @throws {ReactionsRegistryError} When `type` is not lowercase and dot-separated.
 */
export const defineReactionTarget = (
  definition: ReactionTargetDefinition,
): ReactionTargetDefinition => {
  if (!MODERATION_IDENTIFIER_PATTERN.test(definition.type)) {
    throw new ReactionsRegistryError(
      `Reaction target type "${definition.type}" must be lowercase and dot separated, like "forum.topic".`,
    );
  }

  return definition;
};

/** The `reactions` option of `buildApiPlugin`. */
export interface ReactionsPluginConfig {
  /** Custom reaction targets; content types with `reactions` add theirs automatically. */
  targets?: ReactionTargetDefinition[];
}

export interface ReactionsRegistry {
  targets: RegisteredReactionTarget[];
}

export const validateReactionsRegistry = (
  targets: readonly RegisteredReactionTarget[],
): ReactionsRegistry => {
  const byKey = new Map<string, RegisteredReactionTarget>();
  for (const entry of targets) {
    const key = `${entry.pluginId}:${entry.definition.type}`;
    if (byKey.has(key)) {
      throw new ReactionsRegistryError(
        `Reaction target "${entry.definition.type}" is registered twice by ${entry.pluginId}.`,
      );
    }
    byKey.set(key, entry);
  }

  return { targets: [...byKey.values()] };
};

export const findReactionTarget = (
  registry: ReactionsRegistry | undefined,
  { pluginId, type }: { pluginId: string; type: string },
): RegisteredReactionTarget | undefined =>
  registry?.targets.find(
    entry => entry.pluginId === pluginId && entry.definition.type === type,
  );
