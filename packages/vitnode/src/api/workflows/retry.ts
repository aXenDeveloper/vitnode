import {
  WORKFLOW_MAX_RETRY_ATTEMPTS,
  WORKFLOW_RETRY_STRATEGIES,
} from "./const";
import { WORKFLOW_ERROR_CODES, WorkflowError } from "./errors";

export type WorkflowRetryStrategy = (typeof WORKFLOW_RETRY_STRATEGIES)[number];

export interface WorkflowRetryPolicy {
  initialDelayMs: number;
  maxAttempts: number;
  maxDelayMs: number;
  strategy: WorkflowRetryStrategy;
}

/** What a step declares. Every key has a default; see {@link DEFAULT_WORKFLOW_RETRY_POLICY}. */
export type WorkflowRetryPolicyInput = Partial<WorkflowRetryPolicy>;

/**
 * `maxAttempts: 3` means the step body runs at most three times in total -
 * one first run and two retries - not three retries after the first failure.
 */
export const DEFAULT_WORKFLOW_RETRY_POLICY: WorkflowRetryPolicy = {
  initialDelayMs: 1_000,
  maxAttempts: 3,
  maxDelayMs: 60_000,
  strategy: "exponential",
};

const invalid = (message: string, context: { stepId?: string } = {}) =>
  new WorkflowError(
    WORKFLOW_ERROR_CODES.INVALID_RETRY_POLICY,
    context.stepId
      ? `step "${context.stepId}" has an invalid retry policy: ${message}`
      : `invalid retry policy: ${message}`,
  );

const positiveInteger = (value: number): boolean =>
  Number.isSafeInteger(value) && value > 0;

/**
 * Fills a step's `retry` in and refuses a policy that cannot be honoured.
 *
 * Validated once, at definition time, so a workflow with a nonsense backoff
 * fails at boot rather than the first time a step happens to throw in
 * production - which could be weeks later.
 */
export const resolveWorkflowRetryPolicy = (
  input: undefined | WorkflowRetryPolicyInput,
  context: { stepId?: string } = {},
): WorkflowRetryPolicy => {
  const policy = { ...DEFAULT_WORKFLOW_RETRY_POLICY, ...input };

  if (!positiveInteger(policy.maxAttempts)) {
    throw invalid(
      `\`maxAttempts\` must be a positive integer, received ${String(policy.maxAttempts)}.`,
      context,
    );
  }

  if (policy.maxAttempts > WORKFLOW_MAX_RETRY_ATTEMPTS) {
    throw invalid(
      `\`maxAttempts\` may not exceed ${WORKFLOW_MAX_RETRY_ATTEMPTS}, received ${policy.maxAttempts}.`,
      context,
    );
  }

  if (!WORKFLOW_RETRY_STRATEGIES.includes(policy.strategy)) {
    throw invalid(
      `\`strategy\` must be one of ${WORKFLOW_RETRY_STRATEGIES.join(", ")}, received "${policy.strategy}".`,
      context,
    );
  }

  if (
    !Number.isSafeInteger(policy.initialDelayMs) ||
    policy.initialDelayMs < 0
  ) {
    throw invalid(
      `\`initialDelayMs\` must be a non-negative integer, received ${String(policy.initialDelayMs)}.`,
      context,
    );
  }

  if (!Number.isSafeInteger(policy.maxDelayMs) || policy.maxDelayMs < 0) {
    throw invalid(
      `\`maxDelayMs\` must be a non-negative integer, received ${String(policy.maxDelayMs)}.`,
      context,
    );
  }

  if (policy.maxDelayMs < policy.initialDelayMs) {
    throw invalid(
      `\`maxDelayMs\` (${policy.maxDelayMs}) must be greater than or equal to \`initialDelayMs\` (${policy.initialDelayMs}).`,
      context,
    );
  }

  return policy;
};

/**
 * Delay before attempt number `attempts + 1`, where `attempts` counts the runs
 * already made (>= 1 when a retry is being scheduled).
 *
 * The one place the backoff curve is written down. Runners, the AdminCP's
 * "next attempt" column and the tests all read it from here rather than
 * recomputing `2 ** n` in three places that then disagree.
 */
export const workflowRetryDelayMs = (
  policy: WorkflowRetryPolicy,
  attempts: number,
): number => {
  const exponent = Math.max(0, attempts - 1);
  const delay =
    policy.strategy === "fixed"
      ? policy.initialDelayMs
      : policy.initialDelayMs * 2 ** exponent;

  return Math.min(delay, policy.maxDelayMs);
};

/**
 * When the step may run again, or `null` when the policy is exhausted and the
 * step has to be marked `failed`.
 */
export const nextWorkflowAttemptAt = (
  policy: WorkflowRetryPolicy,
  attempts: number,
  from: Date = new Date(),
): Date | null => {
  if (attempts >= policy.maxAttempts) return null;

  return new Date(from.getTime() + workflowRetryDelayMs(policy, attempts));
};
