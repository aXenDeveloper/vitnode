// @vitest-environment node
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { WORKFLOW_ERROR_CODES, WorkflowError } from "./errors";
import { createWorkflowStepOutputs } from "./step-outputs";

const codeOf = (run: () => unknown): string => {
  try {
    run();
  } catch (error) {
    return error instanceof WorkflowError ? error.code : "not-a-workflow-error";
  }

  return "did-not-throw";
};

describe("createWorkflowStepOutputs", () => {
  const outputs = createWorkflowStepOutputs({
    "reserve-inventory": { reservationId: 7 },
  });

  it("reports what has already completed", () => {
    expect(outputs.has("reserve-inventory")).toBe(true);
    expect(outputs.has("authorize-payment")).toBe(false);
  });

  it("parses a previous step's output into a typed value", () => {
    const { reservationId } = outputs.parse(
      "reserve-inventory",
      z.object({ reservationId: z.number() }),
    );

    expect(reservationId).toBe(7);
  });

  it("refuses to read a step that has not completed", () => {
    expect(codeOf(() => outputs.parse("authorize-payment", z.object({})))).toBe(
      WORKFLOW_ERROR_CODES.STEP_NOT_FOUND,
    );
  });

  it("refuses an output that no longer matches the expected shape", () => {
    expect(
      codeOf(() =>
        outputs.parse(
          "reserve-inventory",
          z.object({ reservationId: z.string() }),
        ),
      ),
    ).toBe(WORKFLOW_ERROR_CODES.STEP_OUTPUT_INVALID);
  });

  it("treats a stored null as a real output rather than a missing one", () => {
    const withNull = createWorkflowStepOutputs({ "send-email": null });

    expect(withNull.has("send-email")).toBe(true);
    expect(withNull.parse("send-email", z.null())).toBeNull();
  });
});
