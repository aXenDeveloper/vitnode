import type { z } from "zod";

import type {
  ResolvedWorkflowStep,
  WorkflowDefinition,
  WorkflowStepDefinition,
  WorkflowStepsBuilder,
} from "./types";

import {
  WORKFLOW_ID_MAX_LENGTH,
  WORKFLOW_ID_PATTERN,
  WORKFLOW_STEP_ID_MAX_LENGTH,
} from "./const";
import { WORKFLOW_ERROR_CODES, WorkflowError } from "./errors";
import { resolveWorkflowRetryPolicy } from "./retry";

const assertIdentifier = ({
  kind,
  maxLength,
  value,
  workflowId,
}: {
  kind: "step" | "workflow";
  maxLength: number;
  value: string;
  workflowId?: string;
}): void => {
  if (typeof value !== "string" || value.length === 0) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODES.INVALID_ID,
      `a ${kind} needs a non-empty \`id\`.`,
      { workflowId },
    );
  }

  if (value.length > maxLength) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODES.INVALID_ID,
      `${kind} id "${value}" is longer than ${maxLength} characters.`,
      { workflowId },
    );
  }

  if (!WORKFLOW_ID_PATTERN.test(value)) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODES.INVALID_ID,
      `${kind} id "${value}" must start with a lowercase letter or digit and contain only lowercase letters, digits, ".", "-" and "_". Ids end up in database columns, log lines and third-party idempotency keys, which is why they are restricted.`,
      { workflowId },
    );
  }
};

/**
 * Declares a durable, sequential workflow.
 *
 * The result is plain data - a zod schema, step objects and two identifiers -
 * so the same definition is importable by the plugin that owns it, by the
 * runner (which has no plugin context at all) and by tests, without any of
 * them pulling in the others.
 *
 * ```ts
 * export const placeOrderWorkflow = defineWorkflow({
 *   id: "place-order",
 *   version: 1,
 *   input: z.object({ orderId: z.number().int().positive() }),
 *   steps: ({ step }) => [
 *     step({
 *       id: "reserve-inventory",
 *       retry: { maxAttempts: 3, strategy: "exponential" },
 *       run: async ({ input, idempotencyKey }) => ({ reservationId: 1 }),
 *     }),
 *     step({
 *       id: "authorize-payment",
 *       run: async ({ outputs }) => {
 *         const { reservationId } = outputs.parse(
 *           "reserve-inventory",
 *           z.object({ reservationId: z.number() }),
 *         );
 *
 *         return { chargeId: `ch_${reservationId}` };
 *       },
 *     }),
 *   ],
 * });
 * ```
 */
export const defineWorkflow = <
  const TId extends string,
  TInputSchema extends z.ZodType,
>({
  description,
  id,
  input,
  steps,
  version,
}: {
  description?: string;
  id: TId;
  /** Runtime-validated by `start()`, and the source of every step's `input` type. */
  input: TInputSchema;
  /**
   * Declaration order *is* execution order, and it is frozen into each step's
   * `position` here rather than re-derived later. Reordering steps changes what
   * the workflow means, so it needs a new `version`.
   */
  steps: (
    builder: WorkflowStepsBuilder<z.output<TInputSchema>>,
  ) => WorkflowStepDefinition<z.output<TInputSchema>, unknown>[];
  /** A positive integer, bumped by hand. There is no "latest" anywhere. */
  version: number;
}): WorkflowDefinition<TId, TInputSchema> => {
  assertIdentifier({
    kind: "workflow",
    maxLength: WORKFLOW_ID_MAX_LENGTH,
    value: id,
  });

  if (!Number.isSafeInteger(version) || version < 1) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODES.INVALID_VERSION,
      `\`version\` must be a positive integer, received ${String(version)}. Executions store the version they started with, so it cannot be inferred or defaulted.`,
      { workflowId: id },
    );
  }

  const declared = steps({
    // The per-step output type is checked at this call site and erased
    // afterwards, so one array can hold steps that return different things.
    step: definition =>
      definition as WorkflowStepDefinition<z.output<TInputSchema>, unknown>,
  });

  if (declared.length === 0) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODES.EMPTY_WORKFLOW,
      "a workflow needs at least one step. An execution with nothing to run would be created, queued and completed without ever doing anything, which is a bug worth catching at boot.",
      { workflowId: id, version },
    );
  }

  const seen = new Set<string>();
  const resolved: ResolvedWorkflowStep<z.output<TInputSchema>>[] = declared.map(
    (definition, position) => {
      assertIdentifier({
        kind: "step",
        maxLength: WORKFLOW_STEP_ID_MAX_LENGTH,
        value: definition.id,
        workflowId: id,
      });

      if (seen.has(definition.id)) {
        throw new WorkflowError(
          WORKFLOW_ERROR_CODES.DUPLICATE_STEP,
          `two steps share the id "${definition.id}". Step ids address one row per execution (\`UNIQUE(executionId, stepId)\`) and form the step's idempotency key, so they have to be unique inside a workflow.`,
          { workflowId: id, version },
        );
      }

      seen.add(definition.id);

      return {
        ...definition,
        position,
        retry: resolveWorkflowRetryPolicy(definition.retry, {
          stepId: definition.id,
        }),
      };
    },
  );

  return { description, id, input, steps: resolved, version };
};
