export { syncModerationReportScope } from "./lib/moderation/access";
export type { ModerationPluginConfig } from "./lib/moderation/registry";
export {
  defineModerationScope,
  type ModerationScopeDefinition,
  type ModerationScopeListArgs,
  type ModerationScopeListResult,
  type ModerationScopeResource,
} from "./lib/moderation/scopes";
export {
  defineReportTarget,
  type ModerationActionArgs,
  type ModerationActionOutcome,
  type ModerationCaptureArgs,
  type ModerationCaptureResult,
  type ModerationReportTargetDefinition,
  type ModerationTargetActionDefinition,
  type ModerationTargetAuthors,
  type ModerationTargetState,
} from "./lib/moderation/targets";
