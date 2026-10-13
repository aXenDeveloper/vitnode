import type { Context } from "hono";

import type { ContentDatabase } from "@/content/server/service";
import type { ModerationTargetAction } from "@/lib/moderation/const";
import type { ModerationReportSnapshot } from "@/lib/moderation/snapshot";

import { MODERATION_IDENTIFIER_PATTERN } from "@/lib/moderation/const";

import { ModerationRegistryError } from "./scopes";

export interface ModerationTargetState {
  hidden: boolean;
  url: null | string;
}

export interface ModerationCaptureArgs {
  locale: null | string;
  targetId: string;
}

export type ModerationCaptureResult = Omit<
  ModerationReportSnapshot,
  "capturedAt" | "target" | "truncated" | "version"
>;

export interface ModerationActionArgs {
  actorUserId: number;
  targetId: string;
  tx: ContentDatabase;
}

export interface ModerationActionOutcome {
  changed: boolean;
  effects: () => Promise<void>;
}

export interface ModerationTargetActionDefinition {
  available: (state: ModerationTargetState) => boolean;
  permission: string;
  run: (
    c: Context,
    args: ModerationActionArgs,
  ) => Promise<ModerationActionOutcome | null>;
}

export interface ModerationReportTargetDefinition {
  actions?: Partial<
    Record<ModerationTargetAction, ModerationTargetActionDefinition>
  >;
  capture: (
    c: Context,
    args: ModerationCaptureArgs,
  ) => Promise<ModerationCaptureResult | null>;
  current: (
    c: Context,
    args: { locale: null | string; targetId: string },
  ) => Promise<ModerationTargetState | null>;
  label: string;
  parseId: (value: string) => null | string;
  permissionModule: string;
  resolveScope?: (c: Context, targetId: string) => Promise<string | undefined>;
  scope?: string;
  type: string;
}

export interface RegisteredReportTarget {
  definition: ModerationReportTargetDefinition;
  pluginId: string;
}

export const defineReportTarget = (
  definition: ModerationReportTargetDefinition,
): ModerationReportTargetDefinition => {
  if (!MODERATION_IDENTIFIER_PATTERN.test(definition.type)) {
    throw new ModerationRegistryError(
      `Report target type "${definition.type}" must be lowercase and dot separated, like "forum.topic".`,
    );
  }
  if (definition.scope && !definition.resolveScope) {
    throw new ModerationRegistryError(
      `Report target "${definition.type}" is limited by the "${definition.scope}" scope, so it needs \`resolveScope\`.`,
    );
  }

  return definition;
};
