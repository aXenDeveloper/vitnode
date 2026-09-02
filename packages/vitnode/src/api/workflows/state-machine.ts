import type {
  WORKFLOW_COMPENSATION_STATUSES,
  WORKFLOW_EXECUTION_STATUSES,
  WORKFLOW_STEP_STATUSES,
} from "./const";

import { WORKFLOW_ERROR_CODES, WorkflowError } from "./errors";

export type WorkflowExecutionStatus =
  (typeof WORKFLOW_EXECUTION_STATUSES)[number];
export type WorkflowStepStatus = (typeof WORKFLOW_STEP_STATUSES)[number];
export type WorkflowCompensationStatus =
  (typeof WORKFLOW_COMPENSATION_STATUSES)[number];

/**
 * ```text
 * pending   -> running | cancelled
 * running   -> completed | failed | cancelled
 * completed -> (terminal)
 * failed    -> (terminal)
 * cancelled -> (terminal)
 * ```
 *
 * `failed` is terminal on purpose. Operator-initiated resume (`failed ->
 * running`) is a deliberate future extension and has to be added here first,
 * so nothing can quietly restart a workflow whose steps were never written to
 * be re-entered.
 *
 * `pending -> cancelled` is the cancellation of a workflow the runner has not
 * picked up yet; `running -> cancelled` is the one it noticed *between* steps.
 * The engine never interrupts a step that is already executing - see
 * {@link WorkflowExecutionRecord.cancellationRequestedAt}.
 */
export const WORKFLOW_EXECUTION_TRANSITIONS: Record<
  WorkflowExecutionStatus,
  readonly WorkflowExecutionStatus[]
> = {
  cancelled: [],
  completed: [],
  failed: [],
  pending: ["running", "cancelled"],
  running: ["completed", "failed", "cancelled"],
};

/**
 * ```text
 * pending   -> running | skipped
 * running   -> completed | failed | pending
 * completed -> (terminal)
 * failed    -> (terminal)
 * skipped   -> (terminal)
 * ```
 *
 * `running -> pending` is a scheduled retry: the attempt failed, the policy
 * still allows another, and `nextAttemptAt` says when. `pending -> skipped` is
 * a step the runner never started because the execution was cancelled or an
 * earlier step failed.
 */
export const WORKFLOW_STEP_TRANSITIONS: Record<
  WorkflowStepStatus,
  readonly WorkflowStepStatus[]
> = {
  completed: [],
  failed: [],
  pending: ["running", "skipped"],
  running: ["completed", "failed", "pending"],
  skipped: [],
};

/**
 * ```text
 * none      -> pending
 * pending   -> running
 * running   -> completed | failed | pending
 * ```
 *
 * `running -> pending` is compensation's own retry, which is independent of
 * the step's: a step that ran three times and a rollback that has to be
 * attempted five are unrelated budgets.
 */
export const WORKFLOW_COMPENSATION_TRANSITIONS: Record<
  WorkflowCompensationStatus,
  readonly WorkflowCompensationStatus[]
> = {
  completed: [],
  failed: [],
  none: ["pending"],
  pending: ["running"],
  running: ["completed", "failed", "pending"],
};

const canTransition = <T extends string>(
  table: Record<T, readonly T[]>,
  from: T,
  to: T,
): boolean => table[from].includes(to);

const assertTransition = <T extends string>(
  table: Record<T, readonly T[]>,
  what: string,
  from: T,
  to: T,
): void => {
  if (canTransition(table, from, to)) return;

  const allowed = table[from];

  throw new WorkflowError(
    WORKFLOW_ERROR_CODES.INVALID_TRANSITION,
    `${what} cannot move from "${from}" to "${to}". ${
      allowed.length
        ? `Allowed: ${allowed.join(", ")}.`
        : `"${from}" is terminal.`
    }`,
  );
};

export const canTransitionWorkflowExecution = (
  from: WorkflowExecutionStatus,
  to: WorkflowExecutionStatus,
): boolean => canTransition(WORKFLOW_EXECUTION_TRANSITIONS, from, to);

export const assertWorkflowExecutionTransition = (
  from: WorkflowExecutionStatus,
  to: WorkflowExecutionStatus,
): void =>
  assertTransition(
    WORKFLOW_EXECUTION_TRANSITIONS,
    "A workflow execution",
    from,
    to,
  );

export const canTransitionWorkflowStep = (
  from: WorkflowStepStatus,
  to: WorkflowStepStatus,
): boolean => canTransition(WORKFLOW_STEP_TRANSITIONS, from, to);

export const assertWorkflowStepTransition = (
  from: WorkflowStepStatus,
  to: WorkflowStepStatus,
): void =>
  assertTransition(WORKFLOW_STEP_TRANSITIONS, "A workflow step", from, to);

export const canTransitionWorkflowCompensation = (
  from: WorkflowCompensationStatus,
  to: WorkflowCompensationStatus,
): boolean => canTransition(WORKFLOW_COMPENSATION_TRANSITIONS, from, to);

export const assertWorkflowCompensationTransition = (
  from: WorkflowCompensationStatus,
  to: WorkflowCompensationStatus,
): void =>
  assertTransition(
    WORKFLOW_COMPENSATION_TRANSITIONS,
    "Workflow compensation",
    from,
    to,
  );

export const WORKFLOW_EXECUTION_TERMINAL_STATUSES = [
  "completed",
  "failed",
  "cancelled",
] as const satisfies readonly WorkflowExecutionStatus[];

export const isWorkflowExecutionFinished = (
  status: WorkflowExecutionStatus,
): boolean =>
  (WORKFLOW_EXECUTION_TERMINAL_STATUSES as readonly string[]).includes(status);
