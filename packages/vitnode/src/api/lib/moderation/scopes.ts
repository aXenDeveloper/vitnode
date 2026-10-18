import type { Context } from "hono";

import {
  MODERATION_IDENTIFIER_PATTERN,
  MODERATION_RESOURCE_ID_PATTERN,
} from "@/lib/moderation/const";

/** One resource a moderator permission can be limited to, e.g. a forum section. */
export interface ModerationScopeResource {
  /** Where a nested resource sits, outermost first, e.g. `["Games"]`. Shown next to the label. */
  context?: string[];
  /** The resource id as a string: 1-64 characters of `A-Z`, `a-z`, `0-9`, `.`, `_`, `:`, `-`, starting with a letter or digit. */
  id: string;
  /** The resource's display name, shown as is (not translated). */
  label: string;
}

/** What the AdminCP picker asks {@link ModerationScopeDefinition.list} for. */
export interface ModerationScopeListArgs {
  /** The `nextCursor` of the previous page, or `null` for the first. */
  cursor: null | string;
  /** Page size; the picker asks for 20 and ignores any extra items. */
  limit: number;
  /** Trimmed search text, or `undefined` for none. */
  search?: string;
}

/** One page of resources. */
export interface ModerationScopeListResult {
  items: ModerationScopeResource[];
  /** Passed back as `cursor` for the next page; `null` on the last page. */
  nextCursor: null | string;
}

/**
 * A scope family: a set of resources (forum sections, categories...) that
 * moderator permissions can be limited to. Register it in `buildApiPlugin`'s
 * `moderation.scopes`, and name it as a permission's or report target's `scope`.
 * Server-only - both callbacks read the database.
 */
export interface ModerationScopeDefinition {
  /** Describes the family in the AdminCP permission editor; an i18n key, as for `label`. Dropped when the key is not found. */
  description?: string;
  /**
   * Returns the resources among `ids` that exist. Used to label a saved
   * selection and to refuse grants for ids that are gone. Omit missing ids
   * rather than throwing.
   */
  find: (c: Context, ids: string[]) => Promise<ModerationScopeResource[]>;
  /** Lowercase family id, `a-z0-9` parts joined by `.`, `_` or `-`, e.g. `"forum.section"`. */
  id: string;
  /** The family's name in the AdminCP permission editor, as an i18n key; when the key is not found, the family `id` is shown instead. */
  label: string;
  /** One page of resources for the AdminCP picker, filtered by `search`. */
  list: (
    c: Context,
    args: ModerationScopeListArgs,
  ) => Promise<ModerationScopeListResult>;
}

export interface RegisteredModerationScope {
  definition: ModerationScopeDefinition;
  pluginId: string;
}

export class ModerationRegistryError extends Error {
  constructor(message: string) {
    super(`[moderation] ${message}`);
    this.name = "ModerationRegistryError";
  }
}

/**
 * Declares a scope family for moderator permissions. Returns the definition
 * unchanged after checking its id.
 *
 * @throws {ModerationRegistryError} When `id` is not one or more lowercase
 * `a-z0-9` parts joined by `.`, `_` or `-` (e.g. `"forum.section"`).
 *
 * @example
 * ```ts
 * import { defineModerationScope } from "@vitnode/core/api/moderation";
 *
 * export const categoryScope = defineModerationScope({
 *   id: "example.category",
 *   label: "@vitnode/example.moderation.category.label",
 *   list: async (c, { cursor, limit, search }) => ({ items: [], nextCursor: null }),
 *   find: async (c, ids) => [],
 * });
 * ```
 */
export const defineModerationScope = (
  definition: ModerationScopeDefinition,
): ModerationScopeDefinition => {
  if (!MODERATION_IDENTIFIER_PATTERN.test(definition.id)) {
    throw new ModerationRegistryError(
      `Scope family id "${definition.id}" must be lowercase and dot separated, like "forum.section".`,
    );
  }

  return definition;
};

export const isModerationResourceId = (value: string): boolean =>
  MODERATION_RESOURCE_ID_PATTERN.test(value);
