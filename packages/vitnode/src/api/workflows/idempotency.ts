import {
  WORKFLOW_COMPENSATION_IDEMPOTENCY_SUFFIX,
  WORKFLOW_CRON_IDEMPOTENCY_PREFIX,
  WORKFLOW_EVENT_IDEMPOTENCY_PREFIX,
  WORKFLOW_IDEMPOTENCY_PREFIX,
} from "./const";

/**
 * The key a step body hands to a third-party API.
 *
 * Deterministic, so every attempt of the same step of the same execution -
 * including the attempt that happens after a worker died mid-step - presents
 * the same key and the provider collapses them into one side effect.
 *
 * ```ts
 * await stripe.paymentIntents.create(payload, {
 *   idempotencyKey: ctx.idempotencyKey,
 * });
 * ```
 */
export const workflowStepIdempotencyKey = ({
  executionId,
  stepId,
}: {
  executionId: number;
  stepId: string;
}): string => `${WORKFLOW_IDEMPOTENCY_PREFIX}:${executionId}:${stepId}`;

/**
 * Compensation gets its own key, never the step's.
 *
 * Sharing one would make "refund this charge" collide with "create this
 * charge" at the provider: the second call would be answered with the first
 * call's cached response and the refund would silently never happen.
 */
export const workflowStepCompensationIdempotencyKey = ({
  executionId,
  stepId,
}: {
  executionId: number;
  stepId: string;
}): string =>
  `${workflowStepIdempotencyKey({ executionId, stepId })}:${WORKFLOW_COMPENSATION_IDEMPOTENCY_SUFFIX}`;

/**
 * Execution-level key for a workflow started by an event.
 *
 * `EventEnvelope.eventId` is the unit of delivery, so it is also the unit of
 * de-duplication: a broker that delivers the same envelope twice must produce
 * one execution. Uniqueness is enforced per definition
 * (`pluginId + workflowId + workflowVersion + idempotencyKey`), so two
 * different workflows may both react to the same event - and `place-order@2`
 * is a different subscriber from `place-order@1`.
 */
export const workflowEventIdempotencyKey = (eventId: string): string =>
  `${WORKFLOW_EVENT_IDEMPOTENCY_PREFIX}:${eventId}`;

/**
 * Execution-level key for a workflow started by a cron tick.
 *
 * A cron job has no envelope id, so the tick itself is the unit: the endpoint
 * can be triggered twice for the same minute (an external scheduler retrying,
 * two instances racing) and only one execution may come out of it.
 */
export const workflowCronIdempotencyKey = ({
  name,
  tick,
}: {
  name: string;
  tick: Date;
}): string =>
  `${WORKFLOW_CRON_IDEMPOTENCY_PREFIX}:${name}:${tick.toISOString().slice(0, 16)}`;

export interface WorkflowIdempotencyScope {
  idempotencyKey: string;
  pluginId: string;
  workflowId: string;
  workflowVersion: number;
}

/**
 * The scope the unique index covers, as one string.
 *
 * Only for logs and tests - the database enforces the real constraint - but it
 * keeps "what does idempotent mean here" answerable in one place.
 */
export const workflowIdempotencyScopeKey = ({
  idempotencyKey,
  pluginId,
  workflowId,
  workflowVersion,
}: WorkflowIdempotencyScope): string =>
  `${pluginId}:${workflowId}@${workflowVersion}:${idempotencyKey}`;
