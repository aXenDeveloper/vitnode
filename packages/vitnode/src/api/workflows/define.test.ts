// @vitest-environment node
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { defineWorkflow } from "./define";
import { WORKFLOW_ERROR_CODES, WorkflowError } from "./errors";

const input = z.object({ orderId: z.number().int().positive() });

const codeOf = (run: () => unknown): string => {
  try {
    run();
  } catch (error) {
    return error instanceof WorkflowError ? error.code : "not-a-workflow-error";
  }

  return "did-not-throw";
};

describe("defineWorkflow identity", () => {
  it("keeps the declared id and version", () => {
    const workflow = defineWorkflow({
      id: "place-order",
      input,
      steps: ({ step }) => [step({ id: "reserve", run: () => undefined })],
      version: 1,
    });

    expect(workflow.id).toBe("place-order");
    expect(workflow.version).toBe(1);
  });

  it.each([
    ["", "empty"],
    ["Place-Order", "uppercase"],
    ["-place-order", "leading dash"],
    ["place order", "whitespace"],
    ["a".repeat(101), "over 100 characters"],
  ])("rejects the %s workflow id (%s)", id => {
    expect(
      codeOf(() =>
        defineWorkflow({
          id,
          input,
          steps: ({ step }) => [step({ id: "reserve", run: () => undefined })],
          version: 1,
        }),
      ),
    ).toBe(WORKFLOW_ERROR_CODES.INVALID_ID);
  });

  it.each([0, -1, 1.5, Number.NaN])(
    "rejects the non positive-integer version %s",
    version => {
      expect(
        codeOf(() =>
          defineWorkflow({
            id: "place-order",
            input,
            steps: ({ step }) => [
              step({ id: "reserve", run: () => undefined }),
            ],
            version,
          }),
        ),
      ).toBe(WORKFLOW_ERROR_CODES.INVALID_VERSION);
    },
  );
});

describe("defineWorkflow steps", () => {
  it("freezes declaration order into deterministic positions", () => {
    const workflow = defineWorkflow({
      id: "place-order",
      input,
      steps: ({ step }) => [
        step({ id: "reserve-inventory", run: () => undefined }),
        step({ id: "authorize-payment", run: () => undefined }),
        step({ id: "create-fulfillment", run: () => undefined }),
      ],
      version: 1,
    });

    expect(workflow.steps.map(step => [step.id, step.position])).toEqual([
      ["reserve-inventory", 0],
      ["authorize-payment", 1],
      ["create-fulfillment", 2],
    ]);
  });

  it("rejects duplicate step ids", () => {
    expect(
      codeOf(() =>
        defineWorkflow({
          id: "place-order",
          input,
          steps: ({ step }) => [
            step({ id: "reserve", run: () => undefined }),
            step({ id: "reserve", run: () => undefined }),
          ],
          version: 1,
        }),
      ),
    ).toBe(WORKFLOW_ERROR_CODES.DUPLICATE_STEP);
  });

  it("rejects a workflow with no steps", () => {
    expect(
      codeOf(() =>
        defineWorkflow({
          id: "place-order",
          input,
          steps: () => [],
          version: 1,
        }),
      ),
    ).toBe(WORKFLOW_ERROR_CODES.EMPTY_WORKFLOW);
  });

  it("rejects an invalid step id", () => {
    expect(
      codeOf(() =>
        defineWorkflow({
          id: "place-order",
          input,
          steps: ({ step }) => [
            step({ id: "Reserve Inventory", run: () => undefined }),
          ],
          version: 1,
        }),
      ),
    ).toBe(WORKFLOW_ERROR_CODES.INVALID_ID);
  });

  it("resolves every step's retry policy at definition time", () => {
    const workflow = defineWorkflow({
      id: "place-order",
      input,
      steps: ({ step }) => [
        step({ id: "default-retry", run: () => undefined }),
        step({
          id: "custom-retry",
          retry: { maxAttempts: 5, strategy: "fixed" },
          run: () => undefined,
        }),
      ],
      version: 1,
    });

    expect(workflow.steps[0].retry).toEqual({
      initialDelayMs: 1_000,
      maxAttempts: 3,
      maxDelayMs: 60_000,
      strategy: "exponential",
    });
    expect(workflow.steps[1].retry).toEqual({
      initialDelayMs: 1_000,
      maxAttempts: 5,
      maxDelayMs: 60_000,
      strategy: "fixed",
    });
  });

  it("refuses an invalid retry policy at definition time, not at first failure", () => {
    expect(
      codeOf(() =>
        defineWorkflow({
          id: "place-order",
          input,
          steps: ({ step }) => [
            step({
              id: "reserve",
              retry: { maxAttempts: 0 },
              run: () => undefined,
            }),
          ],
          version: 1,
        }),
      ),
    ).toBe(WORKFLOW_ERROR_CODES.INVALID_RETRY_POLICY);
  });
});
