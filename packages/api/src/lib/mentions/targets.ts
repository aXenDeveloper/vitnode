import type { Context } from "hono";

import type { EnvVitNode } from "@/middlewares/global.middleware";

import { MODERATION_IDENTIFIER_PATTERN } from "@/lib/moderation/const";

/** Thrown at startup when a mention target is misconfigured. */
export class MentionsRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MentionsRegistryError";
  }
}

/**
 * Something whose rich text can `@mention` members and that is not a Content
 * Engine type (those get a target automatically for every rich-text field
 * that keeps `mentions` on). Create it with {@link defineMentionTarget},
 * register it in `buildApiPlugin({ mentions: { targets } })` and call
 * `syncMentions` after every write of its text.
 */
export interface MentionTargetDefinition {
  /**
   * The members among `userIds` who may read target `id` now. Called before a
   * mention notifies, before every email about it and each time an inbox
   * shows it, so a member who loses access stops seeing it. Batched - never
   * once per member. Server-only.
   */
  access: (args: {
    c: Context<EnvVitNode>;
    id: string;
    /** The thread root `syncMentions` was given, if any. */
    rootId: null | string;
    userIds: number[];
  }) => Promise<number[]>;
  /** Stable id stored with every mention, lowercase and dot-separated, e.g. `"newsroom.letter"`. */
  type: string;
}

export interface RegisteredMentionTarget {
  definition: MentionTargetDefinition;
  pluginId: string;
}

/**
 * Validates a custom mention target when the module loads. Server-only.
 *
 * @example
 * ```ts
 * import { defineMentionTarget } from "@vitnode/api/mentions";
 *
 * export const letterMentionTarget = defineMentionTarget({
 *   type: "newsroom.letter",
 *   access: async ({ userIds }) => userIds, // a public letter
 * });
 * ```
 *
 * @throws {MentionsRegistryError} When `type` is not lowercase and dot-separated.
 */
export const defineMentionTarget = (
  definition: MentionTargetDefinition,
): MentionTargetDefinition => {
  if (!MODERATION_IDENTIFIER_PATTERN.test(definition.type)) {
    throw new MentionsRegistryError(
      `Mention target type "${definition.type}" must be lowercase and dot separated, like "forum.topic".`,
    );
  }

  return definition;
};

/** The `mentions` option of `buildApiPlugin`. */
export interface MentionsPluginConfig {
  /** Custom mention targets; content types add theirs automatically. */
  targets?: MentionTargetDefinition[];
}

export interface MentionsRegistry {
  targets: RegisteredMentionTarget[];
}

export const validateMentionsRegistry = (
  targets: readonly RegisteredMentionTarget[],
): MentionsRegistry => {
  const byKey = new Map<string, RegisteredMentionTarget>();
  for (const entry of targets) {
    const key = `${entry.pluginId}:${entry.definition.type}`;
    if (byKey.has(key)) {
      throw new MentionsRegistryError(
        `Mention target "${entry.definition.type}" is registered twice by ${entry.pluginId}.`,
      );
    }
    byKey.set(key, entry);
  }

  return { targets: [...byKey.values()] };
};

export const findMentionTarget = (
  registry: MentionsRegistry | undefined,
  { pluginId, type }: { pluginId: string; type: string },
): RegisteredMentionTarget | undefined =>
  registry?.targets.find(
    entry => entry.pluginId === pluginId && entry.definition.type === type,
  );
