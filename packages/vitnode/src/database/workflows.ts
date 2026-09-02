import { sql } from "drizzle-orm";
import { camelCase, index, unique, uniqueIndex } from "drizzle-orm/pg-core";

import {
  WORKFLOW_ACTOR_TYPES,
  WORKFLOW_COMPENSATION_STATUSES,
  WORKFLOW_EXECUTION_STATUSES,
  WORKFLOW_STEP_STATUSES,
  WORKFLOW_TRIGGER_TYPES,
} from "../api/workflows/const";

/**
 * One durable run of one workflow.
 *
 * The row is the execution's memory: everything the runner needs to pick a
 * queued step up - which plugin, which workflow, **which version**, what the
 * input was - is here, because the worker that resolves it has no request, no
 * plugin context and possibly no shared process with whoever started it.
 *
 * Workflow *definitions* are never stored. They are source code, imported by
 * the plugin that owns them; only their identity and their runtime state live
 * in Postgres.
 */
export const core_workflow_executions = camelCase.table.withRLS(
  "core_workflow_executions",
  t => ({
    id: t.serial().primaryKey(),
    /** Owner of the definition, and the first third of its identity. */
    pluginId: t.varchar({ length: 100 }).notNull(),
    /** The module that registered it - for the AdminCP, never for resolution. */
    module: t.varchar({ length: 100 }).notNull(),
    workflowId: t.varchar({ length: 100 }).notNull(),
    /**
     * The version this execution started on, and the only one it will ever run.
     *
     * Deploying `place-order@2` does not move anything already in flight. If v1
     * is no longer registered the runner fails the execution with
     * `WORKFLOW_DEFINITION_NOT_FOUND` and leaves every row alone, rather than
     * running v2's steps against a plan that was made for v1.
     */
    workflowVersion: t.integer().notNull(),
    status: t
      .varchar({ enum: WORKFLOW_EXECUTION_STATUSES, length: 20 })
      .notNull()
      .default("pending"),
    /**
     * Rollback progress, tracked beside `status` rather than inside it.
     *
     * A combined vocabulary (`failed_compensating`, `failed_compensated`, ...)
     * makes every "did this succeed" query enumerate compensation states it
     * does not care about, and doubles in size each time a new one appears.
     */
    compensationStatus: t
      .varchar({ enum: WORKFLOW_COMPENSATION_STATUSES, length: 20 })
      .notNull()
      .default("none"),
    triggerType: t
      .varchar({ enum: WORKFLOW_TRIGGER_TYPES, length: 20 })
      .notNull()
      .default("manual"),
    /** Event name, cron job name, or a caller-chosen label. */
    triggerName: t.varchar({ length: 255 }),
    /** `EventEnvelope.eventId` for an event trigger, the tick key for cron. */
    triggerId: t.varchar({ length: 255 }),
    /**
     * Who asked for this - metadata, never authorization.
     *
     * No foreign key on purpose: the actor is a fact about the past, and it has
     * to stay readable after the account is gone. Background steps run as
     * system infrastructure regardless of what is recorded here.
     */
    actorType: t
      .varchar({ enum: WORKFLOW_ACTOR_TYPES, length: 20 })
      .notNull()
      .default("system"),
    actorId: t.integer(),
    /** Genuinely schema-dynamic: one column serving every plugin's workflow. */
    input: t.jsonb().$type<Record<string, unknown>>().notNull().default({}),
    /** The last step's output, once the execution completes. */
    output: t.jsonb().$type<unknown>(),
    /**
     * Collapses repeated starts into one execution.
     *
     * Scoped to the definition, not global - see the partial unique index
     * below. `event:{eventId}` for an event trigger, `cron:{name}:{tick}` for a
     * cron one, whatever the caller passed otherwise.
     */
    idempotencyKey: t.varchar({ length: 255 }),
    lastError: t.text(),
    /**
     * When cancellation was *asked for*, which is not when it happened.
     *
     * The runner checks this between steps. A step already executing runs to
     * completion - the engine cannot interrupt arbitrary JavaScript and does
     * not claim to - and everything after it is skipped.
     */
    cancellationRequestedAt: t.timestamp(),
    createdAt: t.timestamp().notNull().defaultNow(),
    startedAt: t.timestamp(),
    completedAt: t.timestamp(),
    cancelledAt: t.timestamp(),
    updatedAt: t
      .timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  }),
  t => [
    // At-least-once delivery means the same start can arrive twice; this is
    // what makes the second one a no-op instead of a second execution. Partial,
    // because an execution with no key is not de-duplicated at all and any
    // number of them may exist.
    uniqueIndex("core_workflow_executions_idempotency_unique")
      .on(t.pluginId, t.workflowId, t.workflowVersion, t.idempotencyKey)
      .where(sql`"idempotencyKey" is not null`),
    // The AdminCP's list and the operator's "what is stuck" query.
    index("core_workflow_executions_status_idx").on(t.status, t.createdAt),
    // "Is anything still running on v1?" - the question a deploy has to answer
    // before an old workflow version may be removed from the code.
    index("core_workflow_executions_definition_idx").on(
      t.pluginId,
      t.workflowId,
      t.workflowVersion,
      t.status,
    ),
  ],
);

/**
 * One row per step of one execution, written up front when the execution is
 * created rather than appearing as the workflow runs.
 *
 * Writing the whole plan at start is what makes the engine restart-safe: after
 * a crash the runner reads state instead of re-deriving it, and an operator can
 * see where a stuck execution stopped without replaying anything.
 */
export const core_workflow_step_executions = camelCase.table.withRLS(
  "core_workflow_step_executions",
  t => ({
    id: t.serial().primaryKey(),
    executionId: t
      .integer()
      .notNull()
      .references(() => core_workflow_executions.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    /** The step's id in the definition. Half of the execution-scoped identity. */
    stepId: t.varchar({ length: 100 }).notNull(),
    /** 0-based declaration order, frozen when the execution was planned. */
    position: t.integer().notNull(),
    status: t
      .varchar({ enum: WORKFLOW_STEP_STATUSES, length: 20 })
      .notNull()
      .default("pending"),
    /** Runs of the step body so far, including the one in flight. */
    attempts: t.integer().notNull().default(0),
    /** Copied from the step's resolved retry policy when the execution is planned. */
    maxAttempts: t.integer().notNull().default(3),
    output: t.jsonb().$type<unknown>(),
    lastError: t.text(),
    /** Set when a failed attempt is retryable; `null` once the policy is spent. */
    nextAttemptAt: t.timestamp(),
    /**
     * Compensation is tracked per step because it is resumable per step: a
     * crash halfway through a rollback has to continue where it stopped, in
     * reverse completion order, without undoing anything twice.
     */
    compensationStatus: t
      .varchar({ enum: WORKFLOW_COMPENSATION_STATUSES, length: 20 })
      .notNull()
      .default("none"),
    compensationAttempts: t.integer().notNull().default(0),
    compensationError: t.text(),
    startedAt: t.timestamp(),
    completedAt: t.timestamp(),
    updatedAt: t
      .timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  }),
  t => [
    // The invariant the whole runner rests on: one row per step per execution,
    // so "has this step already run" is a primary-key question and a duplicated
    // queue delivery cannot create a second attempt row.
    unique("core_workflow_step_executions_step_unique").on(
      t.executionId,
      t.stepId,
    ),
    // The runner's read: this execution's plan, in order.
    index("core_workflow_step_executions_order_idx").on(
      t.executionId,
      t.position,
    ),
    // Retries that have come due.
    index("core_workflow_step_executions_next_attempt_idx").on(
      t.status,
      t.nextAttemptAt,
    ),
  ],
);

export type WorkflowExecutionRow = typeof core_workflow_executions.$inferSelect;
export type WorkflowStepExecutionRow =
  typeof core_workflow_step_executions.$inferSelect;
