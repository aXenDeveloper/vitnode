// @vitest-environment node
import { describe, expect, it } from "vitest";
import { z } from "zod";

import type { RegisteredWorkflowDefinition } from "./types";

import { defineWorkflow } from "./define";
import {
  WORKFLOW_ERROR_CODES,
  WorkflowDefinitionNotFoundError,
  WorkflowError,
} from "./errors";
import {
  nextWorkflowStep,
  requireWorkflowDefinition,
  requireWorkflowStep,
  resolveWorkflowDefinition,
  resolveWorkflowRegistration,
  validateWorkflowDefinitions,
  workflowDefinitionKey,
  workflowDefinitionVersions,
} from "./registry";

const workflow = (id: string, version: number) =>
  defineWorkflow({
    id,
    input: z.object({ orderId: z.number() }),
    steps: ({ step }) => [
      step({ id: "reserve-inventory", run: () => undefined }),
      step({ id: "authorize-payment", run: () => undefined }),
    ],
    version,
  });

const entry = (
  pluginId: string,
  id: string,
  version: number,
  module = "orders",
): RegisteredWorkflowDefinition => ({
  definition: workflow(id, version),
  module,
  pluginId,
});

const codeOf = (run: () => unknown): string => {
  try {
    run();
  } catch (error) {
    return error instanceof WorkflowError ? error.code : "not-a-workflow-error";
  }

  return "did-not-throw";
};

describe("validateWorkflowDefinitions", () => {
  it("rejects the same pluginId + workflowId + version twice", () => {
    expect(
      codeOf(() =>
        validateWorkflowDefinitions([
          entry("@vitnode/shop", "place-order", 1, "orders"),
          entry("@vitnode/shop", "place-order", 1, "checkout"),
        ]),
      ),
    ).toBe(WORKFLOW_ERROR_CODES.DUPLICATE_DEFINITION);
  });

  it("allows v1 and v2 of the same workflow side by side", () => {
    const entries = validateWorkflowDefinitions([
      entry("@vitnode/shop", "place-order", 1),
      entry("@vitnode/shop", "place-order", 2),
    ]);

    expect(entries).toHaveLength(2);
  });

  it("allows the same workflow id in two different plugins", () => {
    expect(
      validateWorkflowDefinitions([
        entry("@vitnode/shop", "place-order", 1),
        entry("@vitnode/blog", "place-order", 1),
      ]),
    ).toHaveLength(2);
  });
});

describe("resolveWorkflowDefinition", () => {
  const entries = [
    entry("@vitnode/shop", "place-order", 1),
    entry("@vitnode/shop", "place-order", 2),
  ];

  it("resolves the exact version asked for", () => {
    expect(
      resolveWorkflowDefinition(entries, {
        pluginId: "@vitnode/shop",
        version: 1,
        workflowId: "place-order",
      })?.definition.version,
    ).toBe(1);
  });

  it("never falls back to the latest version", () => {
    // The whole point of storing `workflowVersion` on the execution: v1 was
    // removed from the deployment, and running v2's steps against a plan made
    // for v1 would be silent corruption.
    const onlyV2 = [entry("@vitnode/shop", "place-order", 2)];

    expect(
      resolveWorkflowDefinition(onlyV2, {
        pluginId: "@vitnode/shop",
        version: 1,
        workflowId: "place-order",
      }),
    ).toBeUndefined();
  });

  it("does not resolve across plugins", () => {
    expect(
      resolveWorkflowDefinition(entries, {
        pluginId: "@vitnode/blog",
        version: 1,
        workflowId: "place-order",
      }),
    ).toBeUndefined();
  });

  it("gives a structured error for a missing version", () => {
    let thrown: unknown;

    try {
      requireWorkflowDefinition([entry("@vitnode/shop", "place-order", 2)], {
        pluginId: "@vitnode/shop",
        version: 1,
        workflowId: "place-order",
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(WorkflowDefinitionNotFoundError);
    expect((thrown as WorkflowDefinitionNotFoundError).code).toBe(
      WORKFLOW_ERROR_CODES.DEFINITION_NOT_FOUND,
    );
    expect((thrown as WorkflowDefinitionNotFoundError).version).toBe(1);
  });

  it("lists deployed versions oldest first", () => {
    expect(
      workflowDefinitionVersions(
        [
          entry("@vitnode/shop", "place-order", 2),
          entry("@vitnode/shop", "place-order", 1),
          entry("@vitnode/shop", "refund-order", 1),
        ],
        { pluginId: "@vitnode/shop", workflowId: "place-order" },
      ),
    ).toEqual([1, 2]);
  });

  it("builds an identity key from plugin, id and version", () => {
    expect(
      workflowDefinitionKey({
        pluginId: "@vitnode/shop",
        version: 3,
        workflowId: "place-order",
      }),
    ).toBe("@vitnode/shop:place-order@3");
  });
});

describe("resolveWorkflowRegistration", () => {
  it("finds the owning plugin of a definition the caller holds", () => {
    const definition = workflow("place-order", 1);
    const entries = [
      { definition, module: "orders", pluginId: "@vitnode/shop" },
    ];

    expect(resolveWorkflowRegistration(entries, definition).pluginId).toBe(
      "@vitnode/shop",
    );
  });

  it("refuses a definition no module registered", () => {
    expect(
      codeOf(() => resolveWorkflowRegistration([], workflow("place-order", 1))),
    ).toBe(WORKFLOW_ERROR_CODES.DEFINITION_NOT_FOUND);
  });

  it("refuses a definition two plugins registered", () => {
    const definition = workflow("place-order", 1);

    expect(
      codeOf(() =>
        resolveWorkflowRegistration(
          [
            { definition, module: "orders", pluginId: "@vitnode/shop" },
            { definition, module: "orders", pluginId: "@vitnode/blog" },
          ],
          definition,
        ),
      ),
    ).toBe(WORKFLOW_ERROR_CODES.DUPLICATE_DEFINITION);
  });
});

describe("step lookup", () => {
  const definition = workflow("place-order", 1);

  it("walks steps in declaration order", () => {
    expect(nextWorkflowStep(definition, "reserve-inventory")?.id).toBe(
      "authorize-payment",
    );
  });

  it("has no next step after the last one", () => {
    expect(nextWorkflowStep(definition, "authorize-payment")).toBeUndefined();
  });

  it("refuses a step the definition does not declare", () => {
    expect(codeOf(() => requireWorkflowStep(definition, "ship-order"))).toBe(
      WORKFLOW_ERROR_CODES.STEP_NOT_FOUND,
    );
  });
});
