import type { WorkflowStore } from "./types";

import { WORKFLOW_ERROR_CODES, WorkflowError } from "./errors";

const notImplemented = (method: keyof WorkflowStore): never => {
  throw new WorkflowError(
    WORKFLOW_ERROR_CODES.NOT_IMPLEMENTED,
    `\`WorkflowStore.${method}()\` has no implementation yet. The Workflow Engine's contracts are frozen but its persistence layer is not written - see docs/architecture/0001-workflow-engine.md.`,
  );
};

/**
 * The Wave 0 placeholder for the persistence layer.
 *
 * Every method throws a structured `WORKFLOW_NOT_IMPLEMENTED`. Nothing in core
 * calls them, so this changes no existing behaviour; it exists so the SDK, the
 * runtime model and the runner can all be written and type-checked against a
 * real boundary while the Drizzle implementation is written behind it.
 *
 * Replaced wholesale by the Drizzle store - the contract is
 * {@link WorkflowStore} in `types.ts`, and it does not move when this file is
 * implemented.
 */
export const workflowStore: WorkflowStore = {
  claimStep: () => notImplemented("claimStep"),
  completeStep: () => notImplemented("completeStep"),
  createExecution: () => notImplemented("createExecution"),
  failStep: () => notImplemented("failStep"),
  finishExecution: () => notImplemented("finishExecution"),
  loadExecution: () => notImplemented("loadExecution"),
  requestCancellation: () => notImplemented("requestCancellation"),
  skipPendingSteps: () => notImplemented("skipPendingSteps"),
  startExecution: () => notImplemented("startExecution"),
};
