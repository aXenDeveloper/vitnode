// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { WorkflowRetryPolicyInput } from "./retry";

import { WORKFLOW_ERROR_CODES, WorkflowError } from "./errors";
import {
  DEFAULT_WORKFLOW_RETRY_POLICY,
  nextWorkflowAttemptAt,
  resolveWorkflowRetryPolicy,
  workflowRetryDelayMs,
} from "./retry";

const codeOf = (run: () => unknown): string => {
  try {
    run();
  } catch (error) {
    return error instanceof WorkflowError ? error.code : "not-a-workflow-error";
  }

  return "did-not-throw";
};

describe("resolveWorkflowRetryPolicy", () => {
  it("fills every key in from the default", () => {
    expect(resolveWorkflowRetryPolicy(undefined)).toEqual(
      DEFAULT_WORKFLOW_RETRY_POLICY,
    );
  });

  it("keeps what the step declared", () => {
    expect(
      resolveWorkflowRetryPolicy({ maxAttempts: 5, strategy: "fixed" }),
    ).toEqual({
      initialDelayMs: 1_000,
      maxAttempts: 5,
      maxDelayMs: 60_000,
      strategy: "fixed",
    });
  });

  it.each<WorkflowRetryPolicyInput>([
    { maxAttempts: 0 },
    { maxAttempts: 2.5 },
    { maxAttempts: 26 },
    { initialDelayMs: -1 },
    { initialDelayMs: 10_000, maxDelayMs: 1_000 },
    { strategy: "linear" as never },
  ])("rejects %o", policy => {
    expect(codeOf(() => resolveWorkflowRetryPolicy(policy))).toBe(
      WORKFLOW_ERROR_CODES.INVALID_RETRY_POLICY,
    );
  });

  it("names the step in the error", () => {
    try {
      resolveWorkflowRetryPolicy({ maxAttempts: 0 }, { stepId: "reserve" });
    } catch (error) {
      expect((error as WorkflowError).message).toContain('step "reserve"');
    }
  });
});

describe("workflowRetryDelayMs", () => {
  const exponential = resolveWorkflowRetryPolicy({
    initialDelayMs: 1_000,
    maxDelayMs: 10_000,
    strategy: "exponential",
  });

  it("doubles each attempt", () => {
    expect(workflowRetryDelayMs(exponential, 1)).toBe(1_000);
    expect(workflowRetryDelayMs(exponential, 2)).toBe(2_000);
    expect(workflowRetryDelayMs(exponential, 3)).toBe(4_000);
  });

  it("caps at maxDelayMs", () => {
    expect(workflowRetryDelayMs(exponential, 10)).toBe(10_000);
  });

  it("stays flat for the fixed strategy", () => {
    const fixed = resolveWorkflowRetryPolicy({
      initialDelayMs: 2_500,
      strategy: "fixed",
    });

    expect(workflowRetryDelayMs(fixed, 1)).toBe(2_500);
    expect(workflowRetryDelayMs(fixed, 7)).toBe(2_500);
  });
});

describe("nextWorkflowAttemptAt", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");
  const policy = resolveWorkflowRetryPolicy({ maxAttempts: 3 });

  it("schedules the next attempt while the budget lasts", () => {
    expect(nextWorkflowAttemptAt(policy, 1, now)?.toISOString()).toBe(
      "2026-01-01T00:00:01.000Z",
    );
    expect(nextWorkflowAttemptAt(policy, 2, now)?.toISOString()).toBe(
      "2026-01-01T00:00:02.000Z",
    );
  });

  it("returns null once maxAttempts is reached, which is what fails the step", () => {
    expect(nextWorkflowAttemptAt(policy, 3, now)).toBeNull();
    expect(nextWorkflowAttemptAt(policy, 4, now)).toBeNull();
  });
});
