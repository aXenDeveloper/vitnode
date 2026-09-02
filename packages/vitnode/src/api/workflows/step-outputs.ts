import type { z } from "zod";

import type { WorkflowStepOutputs } from "./types";

import { WORKFLOW_ERROR_CODES, WorkflowError } from "./errors";

/**
 * Wraps the outputs of already-completed steps, as they came back out of
 * JSONB.
 *
 * The runner reads them from `core_workflow_step_executions.output`, so after
 * a restart there is no in-memory object to hand on - only parsed JSON. That
 * is why `get` is `unknown` and `parse` exists: a step that depends on an
 * earlier step's shape says so, and finds out at the boundary rather than
 * three lines later on a property that is suddenly a string.
 */
export const createWorkflowStepOutputs = (
  outputs: Readonly<Record<string, unknown>>,
): WorkflowStepOutputs => ({
  get: stepId => outputs[stepId],
  has: stepId => Object.hasOwn(outputs, stepId),
  parse: <TOutput>(stepId: string, schema: z.ZodType<TOutput>): TOutput => {
    if (!Object.hasOwn(outputs, stepId)) {
      throw new WorkflowError(
        WORKFLOW_ERROR_CODES.STEP_NOT_FOUND,
        `step "${stepId}" has no recorded output yet. Only steps that completed earlier in this execution can be read - a step cannot depend on one declared after it.`,
      );
    }

    const result = schema.safeParse(outputs[stepId]);

    if (!result.success) {
      throw new WorkflowError(
        WORKFLOW_ERROR_CODES.STEP_OUTPUT_INVALID,
        `the recorded output of step "${stepId}" does not match the expected schema: ${result.error.issues
          .map(issue => `${issue.path.join(".") || "(root)"} ${issue.message}`)
          .join("; ")}.`,
      );
    }

    return result.data;
  },
});
