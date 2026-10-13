import type { Context } from "hono";

import {
  MODERATION_IDENTIFIER_PATTERN,
  MODERATION_RESOURCE_ID_PATTERN,
} from "@/lib/moderation/const";

export interface ModerationScopeResource {
  context?: string[];
  id: string;
  label: string;
}

export interface ModerationScopeListArgs {
  cursor: null | string;
  limit: number;
  search?: string;
}

export interface ModerationScopeListResult {
  items: ModerationScopeResource[];
  nextCursor: null | string;
}

export interface ModerationScopeDefinition {
  description?: string;
  find: (c: Context, ids: string[]) => Promise<ModerationScopeResource[]>;
  id: string;
  label: string;
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
