/**
 * Structured Workflow Engine failures.
 *
 * Every one carries a stable `code`. The runner writes that code into
 * `core_workflow_executions.lastError`, so an operator reading a stuck
 * execution sees the same token the tests assert on rather than a sentence
 * that changed between releases.
 */
export const WORKFLOW_ERROR_CODES = {
  DEFINITION_NOT_FOUND: "WORKFLOW_DEFINITION_NOT_FOUND",
  DUPLICATE_DEFINITION: "WORKFLOW_DUPLICATE_DEFINITION",
  DUPLICATE_STEP: "WORKFLOW_DUPLICATE_STEP",
  EMPTY_WORKFLOW: "WORKFLOW_EMPTY",
  INVALID_ID: "WORKFLOW_INVALID_ID",
  INVALID_INPUT: "WORKFLOW_INVALID_INPUT",
  INVALID_RETRY_POLICY: "WORKFLOW_INVALID_RETRY_POLICY",
  INVALID_TRANSITION: "WORKFLOW_INVALID_TRANSITION",
  INVALID_TRIGGER: "WORKFLOW_INVALID_TRIGGER",
  INVALID_VERSION: "WORKFLOW_INVALID_VERSION",
  NOT_IMPLEMENTED: "WORKFLOW_NOT_IMPLEMENTED",
  STEP_NOT_FOUND: "WORKFLOW_STEP_NOT_FOUND",
  STEP_OUTPUT_INVALID: "WORKFLOW_STEP_OUTPUT_INVALID",
} as const;

export type WorkflowErrorCode =
  (typeof WORKFLOW_ERROR_CODES)[keyof typeof WORKFLOW_ERROR_CODES];

export interface WorkflowErrorOptions {
  cause?: unknown;
  /** `pluginId + workflowId + version`, when the failure is about one. */
  pluginId?: string;
  version?: number;
  workflowId?: string;
}

const describe = ({ pluginId, version, workflowId }: WorkflowErrorOptions) => {
  if (!workflowId) return "";
  const owner = pluginId ? `${pluginId} -> ` : "";
  const at = version === undefined ? "" : `@${version}`;

  return `${owner}${workflowId}${at}: `;
};

/**
 * Thrown while a definition is built or registered (import/boot time), or by
 * the runtime when an execution cannot be resolved or moved.
 */
export class WorkflowError extends Error {
  constructor(
    code: WorkflowErrorCode,
    message: string,
    options: WorkflowErrorOptions = {},
  ) {
    super(`[Workflow] ${describe(options)}${message}`, {
      cause: options.cause,
    });

    this.name = "WorkflowError";
    this.code = code;
    this.pluginId = options.pluginId;
    this.version = options.version;
    this.workflowId = options.workflowId;
  }

  readonly code: WorkflowErrorCode;
  readonly pluginId: string | undefined;
  readonly version: number | undefined;
  readonly workflowId: string | undefined;
}

/**
 * The execution names a definition this deployment does not have.
 *
 * Its own class because it is the one workflow failure an operator is expected
 * to *act* on rather than debug: the code that ran this execution was removed
 * or renamed, and the fix is to put that version back, not to change data. The
 * runner never falls back to another version - see
 * {@link resolveWorkflowDefinition}.
 */
export class WorkflowDefinitionNotFoundError extends WorkflowError {
  constructor({
    pluginId,
    version,
    workflowId,
  }: {
    pluginId: string;
    version: number;
    workflowId: string;
  }) {
    super(
      WORKFLOW_ERROR_CODES.DEFINITION_NOT_FOUND,
      "No workflow definition is registered for this exact version. Keep old workflow versions registered until no execution needs them - the runner never upgrades an in-flight execution to a newer version.",
      { pluginId, version, workflowId },
    );

    this.name = "WorkflowDefinitionNotFoundError";
  }
}
