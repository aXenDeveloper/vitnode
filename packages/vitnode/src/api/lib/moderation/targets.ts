import type { Context } from "hono";

import type { ContentDatabase } from "@/content/server/service";
import type { ModerationTargetAction } from "@/lib/moderation/const";
import type { ModerationReportSnapshot } from "@/lib/moderation/snapshot";

import { MODERATION_IDENTIFIER_PATTERN } from "@/lib/moderation/const";

import { ModerationRegistryError } from "./scopes";

/** A report target as it is now. */
export interface ModerationTargetState {
  hidden: boolean;
  url: null | string;
}

/** What {@link ModerationReportTargetDefinition.resolveAuthors} returns. */
export interface ModerationTargetAuthors {
  /** Every user who wrote the target; a warning can only name one of them. */
  authorIds: number[];
  /** A short plain-text title kept with the warning, or `null`. */
  title: null | string;
}

export interface ModerationCaptureArgs {
  locale: null | string;
  targetId: string;
}

export type ModerationCaptureResult = Omit<
  ModerationReportSnapshot,
  "capturedAt" | "target" | "truncated" | "version"
>;

/** What a moderator action's `run` receives. */
export interface ModerationActionArgs {
  actorUserId: number;
  targetId: string;
  /** The report's transaction; write through it so the action and the report commit together. */
  tx: ContentDatabase;
}

export interface ModerationActionOutcome {
  /** `false` when the target was already in the requested state. */
  changed: boolean;
  /** Side effects (cache, search, events) run after the transaction commits. */
  effects: () => Promise<void>;
}

/** A content action, such as hide or unhide, that moderators run from a report. */
export interface ModerationTargetActionDefinition {
  /** Whether the action applies to the target's current state. */
  available: (state: ModerationTargetState) => boolean;
  /** Moderator permission in the target's `permissionModule` that allows it. */
  permission: string;
  /**
   * Runs inside the report's transaction. Throwing rolls it back and records
   * nothing; `null` means the target no longer exists.
   */
  run: (
    c: Context,
    args: ModerationActionArgs,
  ) => Promise<ModerationActionOutcome | null>;
}

/**
 * Something members can report that is not a Content Engine type (those
 * register their target automatically). Create it with
 * {@link defineReportTarget} and register it in
 * `buildApiPlugin({ moderation: { reportTargets } })`.
 */
export interface ModerationReportTargetDefinition {
  actions?: Partial<
    Record<ModerationTargetAction, ModerationTargetActionDefinition>
  >;
  /**
   * The snapshot stored with a new report, or `null` when the reporter cannot
   * read the target. Runs as the reporter.
   */
  capture: (
    c: Context,
    args: ModerationCaptureArgs,
  ) => Promise<ModerationCaptureResult | null>;
  /** The target now, or `null` once it is deleted. */
  current: (
    c: Context,
    args: { locale: null | string; targetId: string },
  ) => Promise<ModerationTargetState | null>;
  /** i18n key naming the kind of thing, an ICU plural called with `count: 1`. */
  label: string;
  /** Validates and normalizes a client-sent id before anything reads it; `null` rejects it. */
  parseId: (value: string) => null | string;
  /** Moderator permission module the report permissions are added to. */
  permissionModule: string;
  /**
   * The target's current authors and a short plain-text title, or `null` once
   * it is deleted. Server-only; runs as the moderator, so hidden content still
   * resolves. Setting it makes the target warnable: moderators with
   * `can_warn` in `permissionModule` (limited by `scope`) can warn its
   * authors. Content Engine types with `reports` provide it automatically.
   */
  resolveAuthors?: (
    c: Context,
    args: { targetId: string },
  ) => Promise<ModerationTargetAuthors | null>;
  /**
   * The target's resource id in the `scope` family: `""` for none,
   * `undefined` once the target is deleted. Required with `scope`.
   */
  resolveScope?: (c: Context, targetId: string) => Promise<string | undefined>;
  /** Scope family id that limits which moderators see these reports. */
  scope?: string;
  /** Stable id stored in reports, lowercase and dot-separated, e.g. `"forum.topic"`. */
  type: string;
}

export interface RegisteredReportTarget {
  definition: ModerationReportTargetDefinition;
  pluginId: string;
}

/**
 * Validates a custom report target when the module loads.
 *
 * @throws {ModerationRegistryError} When `type` is not lowercase and
 * dot-separated, or `scope` is set without `resolveScope`.
 */
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
