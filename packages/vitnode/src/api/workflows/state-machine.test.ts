// @vitest-environment node
import { describe, expect, it } from "vitest";

import { WORKFLOW_ERROR_CODES, WorkflowError } from "./errors";
import {
  assertWorkflowExecutionTransition,
  assertWorkflowStepTransition,
  canTransitionWorkflowCompensation,
  canTransitionWorkflowExecution,
  canTransitionWorkflowStep,
  isWorkflowExecutionFinished,
} from "./state-machine";

const codeOf = (run: () => unknown): string => {
  try {
    run();
  } catch (error) {
    return error instanceof WorkflowError ? error.code : "not-a-workflow-error";
  }

  return "did-not-throw";
};

describe("execution state machine", () => {
  it.each([
    ["pending", "running"],
    ["pending", "cancelled"],
    ["running", "completed"],
    ["running", "failed"],
    ["running", "cancelled"],
  ] as const)("allows %s -> %s", (from, to) => {
    expect(canTransitionWorkflowExecution(from, to)).toBe(true);
  });

  it.each([
    ["pending", "completed"],
    ["completed", "running"],
    ["cancelled", "running"],
  ] as const)("refuses %s -> %s", (from, to) => {
    expect(canTransitionWorkflowExecution(from, to)).toBe(false);
  });

  it("keeps failed terminal, so nothing resumes a workflow by accident", () => {
    expect(canTransitionWorkflowExecution("failed", "running")).toBe(false);
    expect(
      codeOf(() => assertWorkflowExecutionTransition("failed", "running")),
    ).toBe(WORKFLOW_ERROR_CODES.INVALID_TRANSITION);
  });

  it("knows which statuses are finished", () => {
    expect(isWorkflowExecutionFinished("completed")).toBe(true);
    expect(isWorkflowExecutionFinished("failed")).toBe(true);
    expect(isWorkflowExecutionFinished("cancelled")).toBe(true);
    expect(isWorkflowExecutionFinished("running")).toBe(false);
    expect(isWorkflowExecutionFinished("pending")).toBe(false);
  });
});

describe("step state machine", () => {
  it("lets a failed attempt go back to pending for a scheduled retry", () => {
    expect(canTransitionWorkflowStep("running", "pending")).toBe(true);
  });

  it("lets a step that never started be skipped", () => {
    expect(canTransitionWorkflowStep("pending", "skipped")).toBe(true);
  });

  it("refuses to skip a step that already ran", () => {
    expect(canTransitionWorkflowStep("completed", "skipped")).toBe(false);
    expect(
      codeOf(() => assertWorkflowStepTransition("completed", "skipped")),
    ).toBe(WORKFLOW_ERROR_CODES.INVALID_TRANSITION);
  });

  it("refuses to start a step directly from pending to completed", () => {
    expect(canTransitionWorkflowStep("pending", "completed")).toBe(false);
  });
});

describe("compensation state machine", () => {
  it("starts from none", () => {
    expect(canTransitionWorkflowCompensation("none", "pending")).toBe(true);
    expect(canTransitionWorkflowCompensation("none", "running")).toBe(false);
  });

  it("retries independently of the step", () => {
    expect(canTransitionWorkflowCompensation("running", "pending")).toBe(true);
  });
});
