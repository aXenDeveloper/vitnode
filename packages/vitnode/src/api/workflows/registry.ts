import type {
  AnyWorkflowDefinition,
  RegisteredWorkflowDefinition,
  ResolvedWorkflowStep,
  WorkflowDefinitionRef,
} from "./types";

import {
  WORKFLOW_ERROR_CODES,
  WorkflowDefinitionNotFoundError,
  WorkflowError,
} from "./errors";

/**
 * Identity of one registered definition: `pluginId + workflowId + version`.
 *
 * `workflowId` alone is never an identity. Two versions of the same workflow
 * are two different programs that happen to share a name, and an execution
 * that started on v1 must keep running v1 forever.
 */
export const workflowDefinitionKey = ({
  pluginId,
  version,
  workflowId,
}: WorkflowDefinitionRef): string => `${pluginId}:${workflowId}@${version}`;

export const workflowDefinitionRef = (
  entry: RegisteredWorkflowDefinition,
): WorkflowDefinitionRef => ({
  pluginId: entry.pluginId,
  version: entry.definition.version,
  workflowId: entry.definition.id,
});

/**
 * Refuses two definitions with the same identity, and returns the rest
 * untouched.
 *
 * Run inside `buildApiPlugin` (collisions within one plugin) and again in the
 * global middleware across every installed plugin, for the same reason content
 * types and search indexers are: a plugin can only see its own modules.
 *
 * Registering `place-order@1` and `place-order@2` side by side is not just
 * allowed, it is the supported deployment: old versions stay registered until
 * no execution needs them.
 */
export const validateWorkflowDefinitions = (
  entries: readonly RegisteredWorkflowDefinition[],
): RegisteredWorkflowDefinition[] => {
  const seen = new Map<string, RegisteredWorkflowDefinition>();

  for (const entry of entries) {
    const key = workflowDefinitionKey(workflowDefinitionRef(entry));
    const owner = seen.get(key);

    if (owner) {
      throw new WorkflowError(
        WORKFLOW_ERROR_CODES.DUPLICATE_DEFINITION,
        `already registered by module "${owner.module}" and again by "${entry.module}". A workflow is identified by plugin, id and version - bump \`version\` to register a second definition under the same id.`,
        {
          pluginId: entry.pluginId,
          version: entry.definition.version,
          workflowId: entry.definition.id,
        },
      );
    }

    seen.set(key, entry);
  }

  return [...entries];
};

/**
 * Exact-version lookup. There is deliberately no "latest" variant: an
 * execution row carries the version it started with, and resolving anything
 * else would silently migrate in-flight work onto code it was never planned
 * against.
 */
export const resolveWorkflowDefinition = (
  entries: readonly RegisteredWorkflowDefinition[],
  ref: WorkflowDefinitionRef,
): RegisteredWorkflowDefinition | undefined =>
  entries.find(
    entry =>
      entry.pluginId === ref.pluginId &&
      entry.definition.id === ref.workflowId &&
      entry.definition.version === ref.version,
  );

/**
 * Same lookup, but throws {@link WorkflowDefinitionNotFoundError} instead of
 * returning `undefined`. The runner catches it, fails the execution with the
 * `WORKFLOW_DEFINITION_NOT_FOUND` code and leaves every row in place for an
 * operator to inspect.
 */
export const requireWorkflowDefinition = (
  entries: readonly RegisteredWorkflowDefinition[],
  ref: WorkflowDefinitionRef,
): RegisteredWorkflowDefinition => {
  const entry = resolveWorkflowDefinition(entries, ref);
  if (entry) return entry;

  throw new WorkflowDefinitionNotFoundError({
    pluginId: ref.pluginId,
    version: ref.version,
    workflowId: ref.workflowId,
  });
};

/** Every version of one workflow that is currently deployed, oldest first. */
export const workflowDefinitionVersions = (
  entries: readonly RegisteredWorkflowDefinition[],
  { pluginId, workflowId }: Omit<WorkflowDefinitionRef, "version">,
): number[] =>
  entries
    .filter(
      entry =>
        entry.pluginId === pluginId && entry.definition.id === workflowId,
    )
    .map(entry => entry.definition.version)
    .sort((a, b) => a - b);

/**
 * Finds the registration of a definition the caller already holds.
 *
 * Resolution is by object identity rather than by id, because `start()` has to
 * answer a question the caller cannot: *which plugin owns this*. Guessing from
 * `c.get("plugin")` would be wrong the moment one plugin starts another's
 * workflow, and would write an execution row the runner can never resolve.
 *
 * Not being registered is a hard error for the same reason: an unregistered
 * definition would produce an execution whose steps no deployment can find.
 */
export const resolveWorkflowRegistration = (
  entries: readonly RegisteredWorkflowDefinition[],
  definition: AnyWorkflowDefinition,
): RegisteredWorkflowDefinition => {
  const matches = entries.filter(entry => entry.definition === definition);
  const [entry] = matches;

  if (!entry) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODES.DEFINITION_NOT_FOUND,
      "is not registered. Add it to a module's `workflows: []` - the runner resolves a queued step by plugin, id and version from the execution row, so a definition nothing registered could never be picked up again.",
      { version: definition.version, workflowId: definition.id },
    );
  }

  if (matches.length > 1) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODES.DUPLICATE_DEFINITION,
      `is registered by more than one plugin (${matches.map(match => match.pluginId).join(", ")}), so its owner is ambiguous. Register a definition in exactly one plugin.`,
      { version: definition.version, workflowId: definition.id },
    );
  }

  return entry;
};

export const findWorkflowStep = (
  definition: AnyWorkflowDefinition,
  stepId: string,
): ResolvedWorkflowStep | undefined =>
  definition.steps.find(step => step.id === stepId);

export const requireWorkflowStep = (
  definition: AnyWorkflowDefinition,
  stepId: string,
): ResolvedWorkflowStep => {
  const step = findWorkflowStep(definition, stepId);
  if (step) return step;

  throw new WorkflowError(
    WORKFLOW_ERROR_CODES.STEP_NOT_FOUND,
    `has no step "${stepId}". The execution was planned against a different step list, which means its version was changed in place instead of being bumped.`,
    { version: definition.version, workflowId: definition.id },
  );
};

/** The step that runs after `stepId`, or `undefined` when the workflow is done. */
export const nextWorkflowStep = (
  definition: AnyWorkflowDefinition,
  stepId: string,
): ResolvedWorkflowStep | undefined => {
  const current = requireWorkflowStep(definition, stepId);

  return definition.steps.find(step => step.position === current.position + 1);
};
