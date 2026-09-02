import { z } from "zod";

import { WORKFLOW_STEP_QUEUE_TASK } from "./const";

/**
 * The payload of the one generic `@vitnode/core:workflow-step` task.
 *
 * Two identifiers and nothing else. Everything the runner needs - the plugin,
 * the workflow, the version, the input, the outputs of earlier steps - is read
 * from the execution row, so a task that has been sitting in the queue across a
 * deploy still resolves against the version its execution started on.
 */
export const workflowStepTaskPayloadSchema = z.object({
  executionId: z.number().int().positive(),
  stepId: z.string().min(1),
});

export type WorkflowStepTaskPayload = z.infer<
  typeof workflowStepTaskPayloadSchema
>;

export const workflowStepTaskPayload = (
  payload: WorkflowStepTaskPayload,
): Record<string, unknown> => ({ ...payload });

export { WORKFLOW_STEP_QUEUE_TASK };
