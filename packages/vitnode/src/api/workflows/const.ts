/**
 * Frozen Workflow Engine vocabulary.
 *
 * Deliberately dependency-free: `src/database/workflows.ts` is loaded by
 * `drizzle-kit` in plain Node, so the column enums have to come from a module
 * that imports nothing.
 */

export const WORKFLOW_EXECUTION_STATUSES = [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;

export const WORKFLOW_STEP_STATUSES = [
  "pending",
  "running",
  "completed",
  "failed",
  "skipped",
] as const;

/**
 * Compensation is tracked *beside* the status, never folded into it.
 *
 * A combined vocabulary (`failed_compensating`, `failed_compensated`,
 * `failed_compensation_failed`, ...) multiplies out: every question about
 * "did this workflow succeed" then has to enumerate compensation states it
 * does not care about, and every new compensation state doubles the list.
 */
export const WORKFLOW_COMPENSATION_STATUSES = [
  "none",
  "pending",
  "running",
  "completed",
  "failed",
] as const;

export const WORKFLOW_TRIGGER_TYPES = ["manual", "event", "cron"] as const;

export const WORKFLOW_ACTOR_TYPES = ["admin", "system", "user"] as const;

export const WORKFLOW_RETRY_STRATEGIES = ["fixed", "exponential"] as const;

/**
 * The single generic queue task every workflow step is delivered through,
 * resolved by the worker as `` `@vitnode/core:${WORKFLOW_STEP_QUEUE_TASK}` ``.
 *
 * One task, not one per step: the queue resolves handlers by
 * `` `${pluginId}:${name}` ``, so a task per step would put every plugin's
 * business vocabulary into core's queue namespace and make the runner
 * un-writable - it would have to know each step's name at registration time
 * rather than resolve it from the execution row.
 */
export const WORKFLOW_STEP_QUEUE_TASK = "workflow-step";

/** Queue delivery attempts for one `workflow-step` task. See `retry.ts`. */
export const WORKFLOW_STEP_QUEUE_MAX_ATTEMPTS = 3;

export const WORKFLOW_IDEMPOTENCY_PREFIX = "workflow";
export const WORKFLOW_COMPENSATION_IDEMPOTENCY_SUFFIX = "compensate";
export const WORKFLOW_EVENT_IDEMPOTENCY_PREFIX = "event";
export const WORKFLOW_CRON_IDEMPOTENCY_PREFIX = "cron";

/** Matches the `varchar(100)` columns the identifiers are stored in. */
export const WORKFLOW_ID_MAX_LENGTH = 100;
export const WORKFLOW_STEP_ID_MAX_LENGTH = 100;
export const WORKFLOW_IDEMPOTENCY_KEY_MAX_LENGTH = 255;

/**
 * Identifier shape for workflow and step ids.
 *
 * Both end up in database columns, in log lines and - through
 * `workflow:{executionId}:{stepId}` - inside idempotency keys handed to
 * third-party APIs, so they are restricted to characters that survive all
 * three unchanged.
 */
export const WORKFLOW_ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;

export const WORKFLOW_MAX_RETRY_ATTEMPTS = 25;
