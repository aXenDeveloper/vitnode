import type { Context } from "hono";
import type { z } from "zod";

import type { EnvVitNode } from "../middlewares/global.middleware";
import type { WORKFLOW_ACTOR_TYPES, WORKFLOW_TRIGGER_TYPES } from "./const";
import type { WorkflowRetryPolicy, WorkflowRetryPolicyInput } from "./retry";
import type {
  WorkflowCompensationStatus,
  WorkflowExecutionStatus,
  WorkflowStepStatus,
} from "./state-machine";

export type WorkflowTriggerType = (typeof WORKFLOW_TRIGGER_TYPES)[number];
export type WorkflowActorType = (typeof WORKFLOW_ACTOR_TYPES)[number];

/**
 * A transaction handle, shaped exactly like `QueueModel.dispatch({ tx })`.
 *
 * Passing it is what makes "business row, execution, step rows and queue task
 * commit together or not at all" true. Without it the execution row can commit
 * while the row it is about rolls back, and the runner wakes up to orchestrate
 * something that does not exist.
 */
export type WorkflowTransaction = Omit<Context["var"]["db"], "$client">;

/**
 * Who asked for this workflow, recorded as metadata and nothing more.
 *
 * A queued step runs as system infrastructure: `c.get("admin")` and
 * `c.get("user")` are null inside the runner's request and stay that way. The
 * engine never reconstructs the original request's auth - a background job
 * holding a forged session would make every permission check in the process
 * lie about who is present.
 */
export interface WorkflowActor {
  id?: null | number;
  type: WorkflowActorType;
}

/**
 * What started the execution. Separate from the definition on purpose: one
 * workflow is reachable from code, an event, a cron tick, the AdminCP, the API
 * and a test, and none of those belong in the definition.
 */
export interface WorkflowTriggerRef {
  /**
   * The trigger's own identifier, when it has one worth keeping:
   * `EventEnvelope.eventId` for an event, the tick key for a cron job.
   */
  id?: null | string;
  /** The event name, the cron job name, or a caller-chosen label. */
  name?: null | string;
  type: WorkflowTriggerType;
}

export interface WorkflowExecutionRef {
  id: number;
  pluginId: string;
  workflowId: string;
  workflowVersion: number;
}

/**
 * Reads the outputs of steps that already completed in this execution.
 *
 * `get` returns `unknown` because the value came back out of JSONB: after a
 * restart the runner has a parsed row, not the object the previous step
 * returned, and pretending otherwise would be a lie the type system cannot
 * catch. `parse` is the supported way across that boundary.
 */
export interface WorkflowStepOutputs {
  get: (stepId: string) => unknown;
  has: (stepId: string) => boolean;
  /** Validates a previous step's output, throwing a structured error if it no longer matches. */
  parse: <TOutput>(stepId: string, schema: z.ZodType<TOutput>) => TOutput;
}

export interface WorkflowStepContext<TInput> {
  /** Metadata about who started the workflow. Never an authorization decision. */
  readonly actor: WorkflowActor;
  /** 1 on the first run of this step, 2 on the first retry, and so on. */
  readonly attempt: number;
  /**
   * The runner's Hono context - use it for `c.get("db")`, `c.get("queue")`,
   * `c.get("log")`. It is a background request: no user, no admin, no cookies.
   */
  readonly c: Context<EnvVitNode>;
  readonly execution: WorkflowExecutionRef;
  /** `workflow:{executionId}:{stepId}`. Stable across every attempt. */
  readonly idempotencyKey: string;
  readonly input: TInput;
  readonly outputs: WorkflowStepOutputs;
  readonly step: { id: string; position: number };
  readonly trigger: WorkflowTriggerRef;
}

export interface WorkflowCompensateContext<TInput, TOutput> extends Omit<
  WorkflowStepContext<TInput>,
  "idempotencyKey"
> {
  /** `workflow:{executionId}:{stepId}:compensate`. Never the step's own key. */
  readonly idempotencyKey: string;
  /** What the step returned when it completed. Compensation only runs for completed steps. */
  readonly output: TOutput;
}

export interface WorkflowStepDefinition<TInput, TOutput> {
  /**
   * Undo this step's side effect.
   *
   * Not a SQL rollback: the step already committed, and possibly charged a
   * card. Compensation runs only for steps that *completed*, in reverse
   * completion order, with its own retry budget and its own idempotency key.
   */
  compensate?: (
    ctx: WorkflowCompensateContext<TInput, TOutput>,
  ) => Promise<void> | void;
  description?: string;
  id: string;
  /**
   * Validates what `run` returned before it is written to JSONB, and types
   * `compensate`'s `output`. Omit it and the return value is stored as-is.
   */
  output?: z.ZodType<TOutput>;
  /** Business retry. Queue delivery retry is a separate, lower-level budget. */
  retry?: WorkflowRetryPolicyInput;
  run: (ctx: WorkflowStepContext<TInput>) => Promise<TOutput> | TOutput;
}

/**
 * A step as the registry stores it: the per-step output type is erased so one
 * array can hold steps that return different things, and `retry` is resolved.
 *
 * The typed shape is checked at the `step({ ... })` call site, which is where
 * the developer writes `run` and `compensate` - the same trade-off
 * `buildEventListener` makes.
 */
export interface ResolvedWorkflowStep<TInput = unknown> extends Omit<
  WorkflowStepDefinition<TInput, unknown>,
  "retry"
> {
  /** 0-based, assigned in declaration order and frozen at definition time. */
  position: number;
  retry: WorkflowRetryPolicy;
}

export interface WorkflowStepsBuilder<TInput> {
  step: <TOutput>(
    definition: WorkflowStepDefinition<TInput, TOutput>,
  ) => WorkflowStepDefinition<TInput, unknown>;
}

export interface WorkflowDefinition<
  TId extends string = string,
  TInputSchema extends z.ZodType = z.ZodType,
> {
  description?: string;
  id: TId;
  input: TInputSchema;
  steps: ResolvedWorkflowStep<z.output<TInputSchema>>[];
  /**
   * Bumped by hand whenever the *step list* changes meaning: a step added,
   * removed, renamed or reordered. Executions store the version they started
   * with and are only ever resolved against it.
   */
  version: number;
}

export type AnyWorkflowDefinition = WorkflowDefinition;

/** A definition plus the plugin and module that registered it. */
export interface RegisteredWorkflowDefinition {
  definition: AnyWorkflowDefinition;
  module: string;
  pluginId: string;
}

/** Identity of one definition. Never `workflowId` alone. */
export interface WorkflowDefinitionRef {
  pluginId: string;
  version: number;
  workflowId: string;
}

export interface WorkflowStartOptions {
  /** Defaults to the request's admin, then user, then `{ type: "system" }`. */
  actor?: WorkflowActor;
  /**
   * Collapses repeated starts into one execution, scoped by
   * `pluginId + workflowId + workflowVersion`.
   */
  idempotencyKey?: string;
  trigger?: WorkflowTriggerRef;
  /** Join the caller's transaction, exactly like `QueueModel.dispatch({ tx })`. */
  tx?: WorkflowTransaction;
}

export interface WorkflowStartResult {
  /** True when an execution with this idempotency key already existed. */
  deduplicated: boolean;
  executionId: number;
  status: WorkflowExecutionStatus;
}

/**
 * Everything `start()` decided before anything was written.
 *
 * Pure data, produced by `planWorkflowStart`. Splitting it from the write is
 * what lets the SDK freeze *what* a start means while the persistence layer
 * stays free to choose how the rows are inserted.
 */
export interface WorkflowStartPlan {
  execution: {
    actorId: null | number;
    actorType: WorkflowActorType;
    compensationStatus: WorkflowCompensationStatus;
    idempotencyKey: null | string;
    /** Parsed through the definition's schema, so it is exactly what steps receive. */
    input: Record<string, unknown>;
    module: string;
    pluginId: string;
    status: Extract<WorkflowExecutionStatus, "pending">;
    triggerId: null | string;
    triggerName: null | string;
    triggerType: WorkflowTriggerType;
    workflowId: string;
    workflowVersion: number;
  };
  /**
   * The `@vitnode/core:workflow-step` task to dispatch inside the same
   * transaction. `executionId` is only known after the insert, so the payload
   * is completed by whoever writes the rows.
   */
  queue: {
    maxAttempts: number;
    name: string;
    pluginId: string;
    stepId: string;
  };
  steps: {
    maxAttempts: number;
    position: number;
    status: Extract<WorkflowStepStatus, "pending">;
    stepId: string;
  }[];
}

export interface WorkflowExecutionRecord {
  actorId: null | number;
  actorType: WorkflowActorType;
  cancellationRequestedAt: Date | null;
  cancelledAt: Date | null;
  compensationStatus: WorkflowCompensationStatus;
  completedAt: Date | null;
  createdAt: Date;
  id: number;
  idempotencyKey: null | string;
  input: Record<string, unknown>;
  lastError: null | string;
  module: string;
  output: unknown;
  pluginId: string;
  startedAt: Date | null;
  status: WorkflowExecutionStatus;
  triggerId: null | string;
  triggerName: null | string;
  triggerType: WorkflowTriggerType;
  updatedAt: Date;
  workflowId: string;
  workflowVersion: number;
}

export interface WorkflowStepExecutionRecord {
  attempts: number;
  compensationAttempts: number;
  compensationError: null | string;
  compensationStatus: WorkflowCompensationStatus;
  completedAt: Date | null;
  executionId: number;
  id: number;
  lastError: null | string;
  maxAttempts: number;
  nextAttemptAt: Date | null;
  output: unknown;
  position: number;
  startedAt: Date | null;
  status: WorkflowStepStatus;
  stepId: string;
  updatedAt: Date;
}

export interface WorkflowExecutionWithSteps {
  execution: WorkflowExecutionRecord;
  /** Ordered by `position`. */
  steps: WorkflowStepExecutionRecord[];
}

/**
 * The persistence boundary between the SDK/runtime and the database.
 *
 * Frozen in Wave 0 so the runner can be written against it while the Drizzle
 * implementation is written behind it. Adding a method is fine; changing one
 * of these signatures is a contract change.
 *
 * Every method takes the Hono context rather than a handle, because the
 * request's `c.get("db")` is the default handle and `tx` is the exception.
 */
export interface WorkflowStore {
  /**
   * Move a step from `pending` to `running` and count the attempt.
   *
   * Returns `undefined` when the row was not claimable - already running,
   * already finished, or not due yet. That is the normal answer, not an error:
   * the queue is at-least-once, so the same `workflow-step` task can be
   * delivered twice and the second delivery has to be a no-op.
   */
  claimStep: (
    c: Context,
    args: { executionId: number; stepId: string },
  ) => Promise<undefined | WorkflowStepExecutionRecord>;
  completeStep: (
    c: Context,
    args: { executionId: number; output: unknown; stepId: string },
  ) => Promise<void>;
  /**
   * Insert the execution, its step rows and the first `workflow-step` queue
   * task in one unit of work. Returns the existing execution instead when the
   * plan's idempotency key is already taken.
   */
  createExecution: (
    c: Context,
    plan: WorkflowStartPlan,
    options?: { tx?: WorkflowTransaction },
  ) => Promise<WorkflowStartResult>;
  /**
   * Record a failed attempt. `nextAttemptAt` comes from
   * {@link nextWorkflowAttemptAt}: a date schedules a retry (`running ->
   * pending`), `null` means the policy is exhausted (`running -> failed`).
   */
  failStep: (
    c: Context,
    args: {
      error: string;
      executionId: number;
      nextAttemptAt: Date | null;
      stepId: string;
    },
  ) => Promise<WorkflowStepStatus>;
  /** Terminal transition for the execution itself. */
  finishExecution: (
    c: Context,
    args: {
      executionId: number;
      lastError?: null | string;
      output?: unknown;
      status: Exclude<WorkflowExecutionStatus, "pending" | "running">;
    },
  ) => Promise<void>;
  loadExecution: (
    c: Context,
    executionId: number,
  ) => Promise<undefined | WorkflowExecutionWithSteps>;
  /** Ask for cancellation. Never interrupts a step that is already running. */
  requestCancellation: (c: Context, executionId: number) => Promise<void>;
  /** Everything still `pending` becomes `skipped` - cancellation, or an earlier failure. */
  skipPendingSteps: (c: Context, executionId: number) => Promise<void>;
  /** `pending -> running`, stamping `startedAt` on the first step claim. */
  startExecution: (c: Context, executionId: number) => Promise<void>;
}
