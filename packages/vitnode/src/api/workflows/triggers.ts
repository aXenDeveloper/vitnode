import type { z } from "zod";

import type {
  EventEnvelope,
  VitNodeEventName,
  VitNodeEvents,
} from "../models/events";
import type { AnyWorkflowDefinition, WorkflowDefinition } from "./types";

import { WORKFLOW_ERROR_CODES, WorkflowError } from "./errors";

/**
 * A workflow reacting to a domain event.
 *
 * Kept out of the definition on purpose. `defineWorkflow({ trigger })` would
 * bind one workflow to one way of starting it; the same `place-order` has to
 * be reachable from a route, an event, a cron tick, the AdminCP and a test,
 * and a definition that names its trigger can only ever be the first of those.
 *
 * This is an adapter over the existing event bus, not a second one: the
 * trigger is turned into an ordinary `buildEventListener` at registration, so
 * everything about delivery, ordering and adapters stays where it already is.
 */
export interface WorkflowEventTriggerDefinition {
  description?: string;
  event: VitNodeEventName;
  /**
   * Maps the event payload onto the workflow's input. Must be pure: it runs
   * once, at start, and its result is what every attempt of every step sees.
   */
  input: (payload: never, envelope: EventEnvelope) => unknown;
  /** Listener name, unique within the registering module. */
  name: string;
  /** Skip the event without starting anything. */
  when?: (payload: never, envelope: EventEnvelope) => boolean;
  workflow: AnyWorkflowDefinition;
}

/**
 * A workflow started on a schedule.
 *
 * Registered as an ordinary `buildCron` job by the trigger adapter - there is
 * no second scheduler. The job body does nothing but call
 * `c.get("workflow").start(...)`, so the tick stays cheap and the work is
 * durable from the first row.
 */
export interface WorkflowCronTriggerDefinition {
  description?: string;
  /** Built once per tick. Must be pure. */
  input?: (tick: Date) => unknown;
  name: string;
  /** Standard cron expression, handed straight to the configured cron adapter. */
  schedule: string;
  workflow: AnyWorkflowDefinition;
}

const assertTriggerName = (name: string, kind: "cron" | "event"): void => {
  if (typeof name !== "string" || name.trim().length === 0) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODES.INVALID_TRIGGER,
      `a workflow ${kind} trigger needs a non-empty \`name\`. It identifies the ${kind === "event" ? "listener" : "cron job"} in the AdminCP and in logs.`,
    );
  }
};

/**
 * ```ts
 * buildWorkflowEventTrigger({
 *   name: "start-place-order",
 *   workflow: placeOrderWorkflow,
 *   event: "order.created",
 *   input: payload => ({ orderId: payload.orderId }),
 * });
 * ```
 *
 * De-duplication is not optional here: the adapter starts the workflow with
 * `idempotencyKey = event:{envelope.eventId}`, so a broker that delivers the
 * same envelope twice produces one execution.
 */
export const buildWorkflowEventTrigger = <
  const K extends VitNodeEventName,
  TInputSchema extends z.ZodType,
>(args: {
  description?: string;
  event: K;
  input: (
    payload: VitNodeEvents[K],
    envelope: EventEnvelope<K>,
  ) => z.input<TInputSchema>;
  name: string;
  when?: (payload: VitNodeEvents[K], envelope: EventEnvelope<K>) => boolean;
  workflow: WorkflowDefinition<string, TInputSchema>;
}): WorkflowEventTriggerDefinition => {
  assertTriggerName(args.name, "event");

  // The per-event generic is erased so triggers for different events can share
  // one array - the same trade-off `buildEventListener` makes.
  return args as unknown as WorkflowEventTriggerDefinition;
};

/**
 * ```ts
 * buildWorkflowCronTrigger({
 *   name: "nightly-reconciliation",
 *   schedule: "0 3 * * *",
 *   workflow: reconcileLedgerWorkflow,
 *   input: tick => ({ day: tick.toISOString().slice(0, 10) }),
 * });
 * ```
 *
 * The adapter starts the workflow with
 * `idempotencyKey = cron:{name}:{tick}`, so a scheduler that fires the same
 * minute twice produces one execution.
 */
export const buildWorkflowCronTrigger = <TInputSchema extends z.ZodType>(args: {
  description?: string;
  input?: (tick: Date) => z.input<TInputSchema>;
  name: string;
  schedule: string;
  workflow: WorkflowDefinition<string, TInputSchema>;
}): WorkflowCronTriggerDefinition => {
  assertTriggerName(args.name, "cron");

  if (typeof args.schedule !== "string" || args.schedule.trim().length === 0) {
    throw new WorkflowError(
      WORKFLOW_ERROR_CODES.INVALID_TRIGGER,
      `workflow cron trigger "${args.name}" needs a \`schedule\`.`,
    );
  }

  return args;
};
