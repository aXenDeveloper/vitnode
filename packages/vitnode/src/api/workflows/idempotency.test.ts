// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  workflowCronIdempotencyKey,
  workflowEventIdempotencyKey,
  workflowIdempotencyScopeKey,
  workflowStepCompensationIdempotencyKey,
  workflowStepIdempotencyKey,
} from "./idempotency";

describe("step idempotency keys", () => {
  it("is deterministic for one execution and step", () => {
    const args = { executionId: 182, stepId: "reserve-inventory" };

    expect(workflowStepIdempotencyKey(args)).toBe(
      "workflow:182:reserve-inventory",
    );
    expect(workflowStepIdempotencyKey(args)).toBe(
      workflowStepIdempotencyKey(args),
    );
  });

  it("gives compensation its own key so it cannot collide with the step's", () => {
    const args = { executionId: 182, stepId: "authorize-payment" };

    expect(workflowStepCompensationIdempotencyKey(args)).toBe(
      "workflow:182:authorize-payment:compensate",
    );
    expect(workflowStepCompensationIdempotencyKey(args)).not.toBe(
      workflowStepIdempotencyKey(args),
    );
  });

  it("separates two executions of the same workflow", () => {
    expect(
      workflowStepIdempotencyKey({ executionId: 1, stepId: "reserve" }),
    ).not.toBe(
      workflowStepIdempotencyKey({ executionId: 2, stepId: "reserve" }),
    );
  });
});

describe("trigger idempotency keys", () => {
  it("derives an event key from the envelope id", () => {
    expect(
      workflowEventIdempotencyKey("6f1c1f6e-0000-4000-8000-000000000000"),
    ).toBe("event:6f1c1f6e-0000-4000-8000-000000000000");
  });

  it("derives a cron key from the tick, to the minute", () => {
    expect(
      workflowCronIdempotencyKey({
        name: "nightly-reconciliation",
        tick: new Date("2026-08-26T03:00:41.512Z"),
      }),
    ).toBe("cron:nightly-reconciliation:2026-08-26T03:00");
  });

  it("collapses two deliveries of the same tick", () => {
    const first = workflowCronIdempotencyKey({
      name: "nightly",
      tick: new Date("2026-08-26T03:00:01.000Z"),
    });
    const second = workflowCronIdempotencyKey({
      name: "nightly",
      tick: new Date("2026-08-26T03:00:59.000Z"),
    });

    expect(first).toBe(second);
  });
});

describe("workflowIdempotencyScopeKey", () => {
  const scope = {
    idempotencyKey: "event:abc",
    pluginId: "@vitnode/shop",
    workflowId: "place-order",
    workflowVersion: 1,
  };

  it("scopes a key to one definition version", () => {
    expect(workflowIdempotencyScopeKey(scope)).toBe(
      "@vitnode/shop:place-order@1:event:abc",
    );
  });

  it("treats a new workflow version as a different subscriber", () => {
    expect(workflowIdempotencyScopeKey(scope)).not.toBe(
      workflowIdempotencyScopeKey({ ...scope, workflowVersion: 2 }),
    );
  });

  it("does not collide across plugins reacting to the same event", () => {
    expect(workflowIdempotencyScopeKey(scope)).not.toBe(
      workflowIdempotencyScopeKey({ ...scope, pluginId: "@vitnode/blog" }),
    );
  });
});
