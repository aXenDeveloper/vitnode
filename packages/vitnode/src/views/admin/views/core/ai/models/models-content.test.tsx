import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { IntlProvider } from "use-intl";
import { describe, expect, it, vi } from "vitest";

import type { AdminAiModel } from "../ai-query";

import { AiModelsContent } from "./models-content";

const model = (overrides: Partial<AdminAiModel> = {}): AdminAiModel => ({
  capabilities: ["text", "structured-output"],
  catalogPricing: null,
  id: "fast",
  model: "gpt-fast",
  name: "Fast model",
  pricing: {
    pricing: { rates: { inputPerMillion: "0.15", outputPerMillion: "0.6" } },
    source: "config",
    updatedAt: null,
    version: "config:abc",
  },
  provider: "openai",
  ...overrides,
});

const renderModels = (models: AdminAiModel[], { canManage = true } = {}) => {
  const props = {
    canManage,
    models,
    onDeletePricing: vi.fn(async () =>
      Promise.resolve({ data: true as const }),
    ),
    onSavePricing: vi.fn(async () => Promise.resolve({ data: true as const })),
  };

  render(
    <IntlProvider locale="en" messages={{}} timeZone="UTC">
      <AiModelsContent {...props} />
    </IntlProvider>,
  );

  return props;
};

describe("AiModelsContent", () => {
  it("marks a model without a price instead of pricing it at zero", () => {
    renderModels([model({ pricing: null })]);

    expect(screen.getByText("admin.ai.models.source.none")).toBeTruthy();
    expect(screen.getByText("admin.ai.models.no_price")).toBeTruthy();
    expect(screen.queryByText("$0.00")).toBeNull();
  });

  it("shows capabilities and where the price came from", () => {
    renderModels([model()]);

    expect(screen.getByText("admin.ai.models.capability.text")).toBeTruthy();
    expect(
      screen.getByText("admin.ai.models.capability.structured-output"),
    ).toBeTruthy();
    expect(screen.getByText("admin.ai.models.source.config")).toBeTruthy();
  });

  it("removes a manual price after the admin confirms", async () => {
    const props = renderModels([
      model({
        catalogPricing: {
          rates: { inputPerMillion: "0.15", outputPerMillion: "0.6" },
        },
        pricing: {
          pricing: {
            rates: { inputPerMillion: "0.1", outputPerMillion: "0.4" },
          },
          source: "manual",
          updatedAt: "2026-10-01T10:00:00.000Z",
          version: "manual:3",
        },
      }),
    ]);

    fireEvent.click(
      screen.getByRole("button", { name: "admin.ai.models.reset.open" }),
    );

    const confirm = await screen.findByRole("button", {
      name: "admin.ai.models.reset.confirm",
    });
    expect(screen.getByText("admin.ai.models.reset.desc")).toBeTruthy();

    fireEvent.click(confirm);

    await waitFor(() => {
      expect(props.onDeletePricing).toHaveBeenCalledWith("fast");
    });
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "admin.ai.models.reset.confirm" }),
      ).toBeNull();
    });
  });

  it("offers no reset for a catalog price, and nothing to an admin who may only view", () => {
    renderModels([model()]);

    expect(
      screen.queryByRole("button", { name: "admin.ai.models.reset.open" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "admin.ai.models.pricing_form.open" }),
    ).toBeTruthy();
  });

  it("hides every write from an admin without can_manage", () => {
    renderModels([model({ pricing: null })], { canManage: false });

    expect(screen.queryByRole("button")).toBeNull();
  });
});
