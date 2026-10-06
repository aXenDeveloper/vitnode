import { fireEvent, render, screen } from "@testing-library/react";
import { IntlProvider } from "use-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminAiOverview } from "../ai-query";

import { AiOverviewContent } from "./overview-content";

const overview = (
  overrides: Partial<AdminAiOverview> = {},
): AdminAiOverview => ({
  alt: {
    imagesDescribed: 0,
    knownCostUsd: "0",
    perImageUsd: null,
    perTranslationUsd: null,
    translations: 0,
  },
  averageDailyCostUsd: "0.5",
  averageOperationCostUsd: null,
  budget: {
    limitUsd: "25",
    remainingUsd: "20",
    reservedUsd: "0.1",
    spentUsd: "5",
    systemLimitUsd: null,
    systemSpentUsd: "0",
  },
  byAction: [
    {
      failures: 1,
      key: "@vitnode/blog:excerpt.generate",
      knownCostUsd: "0",
      knownOperations: 0,
      operations: 4,
    },
  ],
  byModel: [],
  byOrigin: [],
  costSources: { estimated: 0, provider: 0, unknown: 4 },
  enabled: true,
  failureRate: 0.25,
  knownCostUsd: "0",
  operations: 4,
  period: {
    end: "2026-11-01T00:00:00.000Z",
    start: "2026-10-01T00:00:00.000Z",
  },
  pricingCoverage: 0,
  tokens: { input: 1200, output: 300 },
  ...overrides,
});

const renderOverview = (data: AdminAiOverview) =>
  render(
    <IntlProvider locale="en" messages={{}} timeZone="UTC">
      <AiOverviewContent
        data={data}
        describeAction={key =>
          key === "@vitnode/blog:excerpt.generate" ? "Generate excerpt" : null
        }
      />
    </IntlProvider>,
  );

describe("AiOverviewContent", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        disconnect() {}
        observe() {}
        unobserve() {}
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("says a cost is unknown rather than showing it as zero", () => {
    renderOverview(overview());

    // The average, both ALT averages and the action's known cost.
    expect(screen.getAllByText("admin.ai.cost.unknown")).toHaveLength(4);
    expect(
      screen.getByText("admin.ai.overview.coverage.unknown_hint"),
    ).toBeTruthy();
  });

  it("names an action by its title and keeps its key", () => {
    renderOverview(overview());

    expect(screen.getByText("Generate excerpt")).toBeTruthy();
    expect(screen.getByText("@vitnode/blog:excerpt.generate")).toBeTruthy();
  });

  it("switches the breakdown between actions, models and origins", () => {
    renderOverview(overview());

    fireEvent.click(
      screen.getByRole("tab", {
        name: "admin.ai.overview.breakdown.by_model",
      }),
    );

    expect(screen.getByText("admin.ai.overview.breakdown.empty")).toBeTruthy();
  });

  it("shows how much of the monthly budget is spent", () => {
    renderOverview(overview());

    const bar = screen.getByRole("progressbar", {
      name: "admin.ai.overview.budget.spent",
    });

    expect(bar.getAttribute("aria-valuenow")).toBe("5");
    expect(bar.getAttribute("aria-valuemax")).toBe("25");
  });
});
