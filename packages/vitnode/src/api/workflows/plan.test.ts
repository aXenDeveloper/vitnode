// @vitest-environment node
import { describe, expect, it } from "vitest";
import { z } from "zod";

import type { RegisteredWorkflowDefinition } from "./types";

import { defineWorkflow } from "./define";
import { WORKFLOW_ERROR_CODES, WorkflowError } from "./errors";
import { planWorkflowStart } from "./plan";

const placeOrder = defineWorkflow({
  id: "place-order",
  input: z.object({ orderId: z.number().int().positive() }),
  steps: ({ step }) => [
    step({
      id: "reserve-inventory",
      retry: { maxAttempts: 5 },
      run: () => undefined,
    }),
    step({ id: "authorize-payment", run: () => undefined }),
  ],
  version: 2,
});

const entry: RegisteredWorkflowDefinition = {
  definition: placeOrder,
  module: "orders",
  pluginId: "@vitnode/shop",
};

const codeOf = (run: () => unknown): string => {
  try {
    run();
  } catch (error) {
    return error instanceof WorkflowError ? error.code : "not-a-workflow-error";
  }

  return "did-not-throw";
};

describe("planWorkflowStart execution row", () => {
  it("stamps the exact definition identity the runner has to resolve", () => {
    const plan = planWorkflowStart({ entry, input: { orderId: 42 } });

    expect(plan.execution).toMatchObject({
      module: "orders",
      pluginId: "@vitnode/shop",
      status: "pending",
      workflowId: "place-order",
      workflowVersion: 2,
    });
  });

  it("starts with no compensation and no trigger metadata", () => {
    const plan = planWorkflowStart({ entry, input: { orderId: 42 } });

    expect(plan.execution.compensationStatus).toBe("none");
    expect(plan.execution.triggerType).toBe("manual");
    expect(plan.execution.triggerId).toBeNull();
    expect(plan.execution.triggerName).toBeNull();
  });

  it("records the actor as metadata, defaulting to system", () => {
    expect(
      planWorkflowStart({ entry, input: { orderId: 42 } }).execution,
    ).toMatchObject({ actorId: null, actorType: "system" });

    expect(
      planWorkflowStart({
        entry,
        input: { orderId: 42 },
        options: { actor: { id: 9, type: "admin" } },
      }).execution,
    ).toMatchObject({ actorId: 9, actorType: "admin" });
  });

  it("stores the parsed input, so steps see exactly what was validated", () => {
    const plan = planWorkflowStart({
      entry,
      input: { extra: "dropped", orderId: 42 },
    });

    expect(plan.execution.input).toEqual({ orderId: 42 });
  });

  it("carries an event trigger's envelope id as the idempotency key", () => {
    const plan = planWorkflowStart({
      entry,
      input: { orderId: 42 },
      options: {
        idempotencyKey: "event:abc",
        trigger: { id: "abc", name: "order.created", type: "event" },
      },
    });

    expect(plan.execution).toMatchObject({
      idempotencyKey: "event:abc",
      triggerId: "abc",
      triggerName: "order.created",
      triggerType: "event",
    });
  });
});

describe("planWorkflowStart step rows", () => {
  it("writes the whole plan up front, pending and in order", () => {
    const plan = planWorkflowStart({ entry, input: { orderId: 42 } });

    expect(plan.steps).toEqual([
      {
        maxAttempts: 5,
        position: 0,
        status: "pending",
        stepId: "reserve-inventory",
      },
      {
        maxAttempts: 3,
        position: 1,
        status: "pending",
        stepId: "authorize-payment",
      },
    ]);
  });

  it("queues one generic core task for the first step only", () => {
    const plan = planWorkflowStart({ entry, input: { orderId: 42 } });

    expect(plan.queue).toEqual({
      maxAttempts: 3,
      name: "workflow-step",
      pluginId: "@vitnode/core",
      stepId: "reserve-inventory",
    });
  });
});

describe("planWorkflowStart validation", () => {
  it("refuses input the workflow's schema rejects", () => {
    expect(
      codeOf(() => planWorkflowStart({ entry, input: { orderId: -1 } })),
    ).toBe(WORKFLOW_ERROR_CODES.INVALID_INPUT);
  });

  it("refuses input that does not parse to an object", () => {
    const scalar: RegisteredWorkflowDefinition = {
      definition: defineWorkflow({
        id: "scalar-input",
        input: z.number(),
        steps: ({ step }) => [step({ id: "run", run: () => undefined })],
        version: 1,
      }),
      module: "orders",
      pluginId: "@vitnode/shop",
    };

    expect(codeOf(() => planWorkflowStart({ entry: scalar, input: 1 }))).toBe(
      WORKFLOW_ERROR_CODES.INVALID_INPUT,
    );
  });

  it("refuses an empty idempotency key rather than silently ignoring it", () => {
    expect(
      codeOf(() =>
        planWorkflowStart({
          entry,
          input: { orderId: 42 },
          options: { idempotencyKey: "" },
        }),
      ),
    ).toBe(WORKFLOW_ERROR_CODES.INVALID_INPUT);
  });

  it("refuses an idempotency key longer than the column", () => {
    expect(
      codeOf(() =>
        planWorkflowStart({
          entry,
          input: { orderId: 42 },
          options: { idempotencyKey: "a".repeat(256) },
        }),
      ),
    ).toBe(WORKFLOW_ERROR_CODES.INVALID_INPUT);
  });
});
