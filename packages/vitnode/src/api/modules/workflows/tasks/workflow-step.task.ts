import { buildQueueTask } from "@/api/lib/queue";
import {
  WORKFLOW_STEP_QUEUE_MAX_ATTEMPTS,
  WORKFLOW_STEP_QUEUE_TASK,
} from "@/api/workflows/const";
import { WORKFLOW_ERROR_CODES, WorkflowError } from "@/api/workflows/errors";
import { workflowStepTaskPayloadSchema } from "@/api/workflows/queue-task";

/**
 * The one queue task every workflow step in the installation is delivered
 * through, resolved by the worker as `@vitnode/core:workflow-step`.
 *
 * One generic task rather than one per step. The queue resolves handlers by
 * `` `${pluginId}:${name}` ``, so a task named after each business step would
 * put `shop-authorize-payment` into core's namespace and force registration to
 * happen before anybody knows the step list. Here the payload names the
 * execution and the step, and the runner reads plugin, workflow, version, input
 * and previous outputs from the execution row - which is also why a task that
 * sat in the queue across a deploy still resolves against the version its
 * execution started on.
 *
 * `maxAttempts` here is *delivery* retry: the worker could not reach the runner
 * at all. A step body that fails is a different budget, owned by the step's own
 * `retry` policy.
 *
 * The runner itself is Wave 1. This registration exists so its home, its name
 * and its payload are already fixed.
 */
export const workflowStepQueueTask = buildQueueTask({
  description: "Run one step of a durable workflow execution",
  maxAttempts: WORKFLOW_STEP_QUEUE_MAX_ATTEMPTS,
  name: WORKFLOW_STEP_QUEUE_TASK,
  handler: (_c, payload) => {
    const parsed = workflowStepTaskPayloadSchema.parse(payload);

    throw new WorkflowError(
      WORKFLOW_ERROR_CODES.NOT_IMPLEMENTED,
      `no runner is registered for execution ${parsed.executionId}, step "${parsed.stepId}". The Workflow Engine's contracts are frozen but its runner is not implemented - see docs/architecture/0001-workflow-engine.md.`,
    );
  },
});
