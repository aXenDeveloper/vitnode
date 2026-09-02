import type {
  RegisteredWorkflowDefinition,
  WorkflowStartOptions,
  WorkflowStartPlan,
} from "./types";

import {
  WORKFLOW_IDEMPOTENCY_KEY_MAX_LENGTH,
  WORKFLOW_STEP_QUEUE_MAX_ATTEMPTS,
  WORKFLOW_STEP_QUEUE_TASK,
} from "./const";
import { WORKFLOW_ERROR_CODES, WorkflowError } from "./errors";

const CORE_PLUGIN_ID = "@vitnode/core";

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Everything `WorkflowModel.start()` decides, with nothing written.
 *
 * Pure on purpose. "What does starting this workflow mean" is a property of
 * the definition and the caller's arguments, not of the database, so it is
 * decided - and unit-tested - without one. The persistence layer receives a
 * finished plan and only has to insert it.
 *
 * Note what is *not* here: running a step. `start()` validates, writes rows and
 * queues the first `workflow-step` task. Step 1 never executes inside the
 * caller's HTTP request, so a slow inventory call cannot become a slow
 * checkout response, and a crash after the commit still leaves the work queued.
 */
export const planWorkflowStart = ({
  entry,
  input,
  options = {},
}: {
  entry: RegisteredWorkflowDefinition;
  input: unknown;
  options?: Omit<WorkflowStartOptions, "tx">;
}): WorkflowStartPlan => {
  const { definition, module, pluginId } = entry;
  const parsed = definition.input.safeParse(input);

  if (!parsed.success) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODES.INVALID_INPUT,
      `input does not match the workflow's schema: ${parsed.error.issues
        .map(issue => `${issue.path.join(".") || "(root)"} ${issue.message}`)
        .join("; ")}.`,
      { pluginId, version: definition.version, workflowId: definition.id },
    );
  }

  if (!isPlainObject(parsed.data)) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODES.INVALID_INPUT,
      "`input` must parse to a plain object. The execution's input is stored as JSONB and rendered field by field in the AdminCP, so a bare scalar or array has nothing to key on - wrap it, e.g. `z.object({ orderId: z.number() })`.",
      { pluginId, version: definition.version, workflowId: definition.id },
    );
  }

  const idempotencyKey = options.idempotencyKey ?? null;

  if (idempotencyKey !== null) {
    if (idempotencyKey.length === 0) {
      throw new WorkflowError(
        WORKFLOW_ERROR_CODES.INVALID_INPUT,
        "`idempotencyKey` cannot be an empty string. Omit it entirely to start an execution that is not de-duplicated.",
        { pluginId, version: definition.version, workflowId: definition.id },
      );
    }

    if (idempotencyKey.length > WORKFLOW_IDEMPOTENCY_KEY_MAX_LENGTH) {
      throw new WorkflowError(
        WORKFLOW_ERROR_CODES.INVALID_INPUT,
        `\`idempotencyKey\` is longer than ${WORKFLOW_IDEMPOTENCY_KEY_MAX_LENGTH} characters.`,
        { pluginId, version: definition.version, workflowId: definition.id },
      );
    }
  }

  const trigger = options.trigger ?? { type: "manual" };
  const actor = options.actor ?? { type: "system" };
  const [firstStep] = definition.steps;

  return {
    execution: {
      actorId: actor.id ?? null,
      actorType: actor.type,
      compensationStatus: "none",
      idempotencyKey,
      input: parsed.data,
      module,
      pluginId,
      status: "pending",
      triggerId: trigger.id ?? null,
      triggerName: trigger.name ?? null,
      triggerType: trigger.type,
      workflowId: definition.id,
      workflowVersion: definition.version,
    },
    // One generic core task, whoever owns the workflow. The runner resolves
    // execution -> plugin -> workflow -> version -> step -> code from the row.
    queue: {
      maxAttempts: WORKFLOW_STEP_QUEUE_MAX_ATTEMPTS,
      name: WORKFLOW_STEP_QUEUE_TASK,
      pluginId: CORE_PLUGIN_ID,
      stepId: firstStep.id,
    },
    // Every step is written up front, `pending`, in declaration order. The
    // execution's plan is therefore visible in the database from the moment it
    // is created, rather than appearing one row at a time as it runs.
    steps: definition.steps.map(step => ({
      maxAttempts: step.retry.maxAttempts,
      position: step.position,
      status: "pending",
      stepId: step.id,
    })),
  };
};
