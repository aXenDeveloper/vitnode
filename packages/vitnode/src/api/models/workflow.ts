import type { Context } from "hono";
import type { z } from "zod";

import type {
  RegisteredWorkflowDefinition,
  WorkflowActor,
  WorkflowDefinition,
  WorkflowDefinitionRef,
  WorkflowStartOptions,
  WorkflowStartResult,
} from "@/api/workflows/types";

import { planWorkflowStart } from "@/api/workflows/plan";
import {
  requireWorkflowDefinition,
  resolveWorkflowRegistration,
} from "@/api/workflows/registry";
import { workflowStore } from "@/api/workflows/store";

/**
 * Durable multi-step business operations, exposed on the request context as
 * `c.get("workflow")`.
 *
 * The engine orchestrates; it does not re-implement what VitNode already has.
 * Events say something happened, the queue executes something later, cron
 * initiates something on a schedule - a workflow strings those into one
 * restartable, versioned, idempotent sequence and owns nothing else. Steps are
 * delivered through the existing `core_queue`; there is no second queue, no
 * second scheduler and no second event bus.
 *
 * Execution is **at-least-once**, never exactly-once. A step's side effect can
 * succeed and the worker can die before the completion is recorded, in which
 * case the step runs again - which is why every step context carries an
 * `idempotencyKey`.
 */
export class WorkflowModel {
  constructor(c: Context) {
    this.c = c;
  }

  protected readonly c: Context;

  private registered(): RegisteredWorkflowDefinition[] {
    return this.c.get("core").workflows;
  }

  /**
   * The actor recorded on the execution: metadata only.
   *
   * A queued step never impersonates them. The runner's request has no session
   * at all, and reconstructing one would make `c.get("admin")` lie for every
   * other model sharing that context.
   */
  private requestActor(): WorkflowActor {
    const admin = this.c.get("admin");
    if (admin) return { id: admin.user.id, type: "admin" };

    const user = this.c.get("user");
    if (user) return { id: user.id, type: "user" };

    return { type: "system" };
  }

  /**
   * Ask for an execution to stop.
   *
   * VitNode cannot interrupt JavaScript that is already running, and does not
   * pretend to: this records the request, the runner notices it *between*
   * steps, the step in flight finishes normally, and everything still pending
   * is skipped.
   */
  async cancel(executionId: number): Promise<void> {
    await workflowStore.requestCancellation(this.c, executionId);
  }

  /**
   * Exact-version lookup, for the runner and the AdminCP.
   *
   * Throws `WORKFLOW_DEFINITION_NOT_FOUND` when this deployment no longer
   * registers that version. It never falls back to a newer one - an execution
   * planned against v1 would then run v2's steps against v1's rows.
   */
  definition(ref: WorkflowDefinitionRef): RegisteredWorkflowDefinition {
    return requireWorkflowDefinition(this.registered(), ref);
  }

  /**
   * Create a durable execution and hand the first step to the queue.
   *
   * ```ts
   * await c.get("workflow").start(placeOrderWorkflow, { orderId: 42 });
   * ```
   *
   * Pass `tx` to join the caller's transaction, exactly like
   * `QueueModel.dispatch({ tx })`, so the business row, the execution, its step
   * rows and the queue task commit together or not at all:
   *
   * ```ts
   * await db.transaction(async tx => {
   *   const order = await createOrder(tx);
   *   await c.get("workflow").start(placeOrderWorkflow, { orderId: order.id }, { tx });
   * });
   * ```
   *
   * **No step runs here.** `start()` validates the input, writes the execution
   * and its steps, queues one `workflow-step` task and returns - so a checkout
   * request never waits on an inventory call, and a crash a millisecond after
   * the commit still leaves the work queued.
   */
  async start<TInputSchema extends z.ZodType>(
    workflow: WorkflowDefinition<string, TInputSchema>,
    input: z.input<TInputSchema>,
    options: WorkflowStartOptions = {},
  ): Promise<WorkflowStartResult> {
    const entry = resolveWorkflowRegistration(this.registered(), workflow);
    const plan = planWorkflowStart({
      entry,
      input,
      options: {
        actor: options.actor ?? this.requestActor(),
        idempotencyKey: options.idempotencyKey,
        trigger: options.trigger,
      },
    });

    return await workflowStore.createExecution(this.c, plan, {
      tx: options.tx,
    });
  }
}
