// @vitest-environment jsdom
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { IntlProvider } from "use-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminAiOverview, AiUsageTotals } from "../ai-query";

import { AiOverviewContent } from "./overview-content";

const totals = (overrides: Partial<AiUsageTotals> = {}): AiUsageTotals => ({
  chargedUsd: "0",
  failures: 0,
  inputTokens: 0,
  knownCostUsd: "0",
  knownOperations: 0,
  operations: 0,
  outputTokens: 0,
  ...overrides,
});

const overview = (
  overrides: Partial<AdminAiOverview> = {},
  budget: Partial<AdminAiOverview["budget"]> = {},
): AdminAiOverview => ({
  budget: {
    dailyRateUsd: "6",
    days: [
      { costUsd: "10", day: "2026-10-01" },
      { costUsd: "20", day: "2026-10-02" },
    ],
    end: "2026-10-31",
    forecastUsd: "200",
    limitUsd: "150",
    live: true,
    month: "2026-10",
    monthlyAtRateUsd: "186",
    previousDays: [{ costUsd: "5", day: "2026-09-01" }],
    reservedUsd: "0",
    spentUsd: "30",
    start: "2026-10-01",
    ...budget,
  },
  byAction: [
    {
      current: totals({
        knownCostUsd: "30",
        knownOperations: 3,
        operations: 3,
      }),
      key: "@vitnode/core:editor.quick-ask",
      previous: totals({
        knownCostUsd: "10",
        knownOperations: 1,
        operations: 1,
      }),
    },
    {
      current: totals({ operations: 4 }),
      key: "@vitnode/blog:excerpt.generate",
      previous: totals(),
    },
  ],
  byModel: [
    {
      current: totals({
        knownCostUsd: "30",
        knownOperations: 3,
        operations: 7,
      }),
      key: "anthropic/claude-sonnet-4-5",
      previous: totals({
        knownCostUsd: "10",
        knownOperations: 1,
        operations: 1,
      }),
    },
  ],
  compare: {
    days: [
      { ...totals({ knownCostUsd: "10", operations: 1 }), day: "2026-09-01" },
      { ...totals(), day: "2026-09-02" },
    ],
    end: "2026-09-02",
    kind: "month-to-date",
    start: "2026-09-01",
    totals: totals({ knownCostUsd: "10", knownOperations: 1, operations: 1 }),
  },
  enabled: true,
  firstDay: "2026-07-09",
  range: {
    days: [
      { ...totals({ knownCostUsd: "10", operations: 3 }), day: "2026-10-01" },
      { ...totals({ knownCostUsd: "20", operations: 4 }), day: "2026-10-02" },
    ],
    end: "2026-10-02",
    preset: "this-month",
    start: "2026-10-01",
    totals: totals({ knownCostUsd: "30", knownOperations: 3, operations: 7 }),
  },
  timeZone: "UTC",
  today: "2026-10-02",
  ...overrides,
});

const renderOverview = async (
  data: AdminAiOverview,
  onMonthChange: (month: string) => void = vi.fn(),
) => {
  const rootRoute = createRootRoute({
    component: () => (
      <AiOverviewContent
        data={data}
        describeAction={key =>
          key === "@vitnode/blog:excerpt.generate" ? "Generate excerpt" : null
        }
        describeModel={id =>
          id === "anthropic/claude-sonnet-4-5" ? "Claude Sonnet 4.5" : null
        }
        onMonthChange={onMonthChange}
      />
    ),
  });
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ["/"] }),
    routeTree: rootRoute,
  });

  render(
    <IntlProvider locale="en" messages={{}} timeZone="UTC">
      <RouterProvider router={router} />
    </IntlProvider>,
  );

  await screen.findByText("admin.ai.overview.breakdown.title");
};

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

  it("says a cost is unknown rather than showing it as zero", async () => {
    await renderOverview(overview());

    expect(screen.getByText("admin.ai.cost.unknown")).toBeTruthy();
    expect(
      screen.getByText("admin.ai.overview.breakdown.unpriced"),
    ).toBeTruthy();
  });

  it("names an action by its title and keeps its key", async () => {
    await renderOverview(overview());

    const table = within(screen.getByRole("table"));

    expect(table.getByText("Generate excerpt")).toBeTruthy();
    expect(table.getByText("@vitnode/blog:excerpt.generate")).toBeTruthy();
  });

  it("switches the breakdown from actions to models", async () => {
    await renderOverview(overview());

    fireEvent.click(
      screen.getByRole("tab", {
        name: "admin.ai.overview.breakdown.by_model",
      }),
    );

    const table = within(screen.getByRole("table"));

    expect(table.getByText("Claude Sonnet 4.5")).toBeTruthy();
    expect(table.getByText("anthropic/claude-sonnet-4-5")).toBeTruthy();
    expect(table.queryByText("Generate excerpt")).toBeNull();
  });

  it("warns when this month is on pace to pass its budget", async () => {
    await renderOverview(overview());

    expect(screen.getByRole("alert").textContent).toContain(
      "admin.ai.overview.budget.forecast_over",
    );
    expect(
      screen.getByRole("img", { name: "admin.ai.overview.budget.meter" }),
    ).toBeTruthy();
  });

  it("reports a past month as closed instead of forecasting it", async () => {
    await renderOverview(
      overview(
        {},
        {
          end: "2026-09-30",
          forecastUsd: null,
          live: false,
          month: "2026-09",
          spentUsd: "146",
          start: "2026-09-01",
        },
      ),
    );

    expect(screen.getByRole("status").textContent).toContain(
      "admin.ai.overview.budget.closed",
    );
  });

  it("steps the budget back a month, but never past this month", async () => {
    const onMonthChange = vi.fn();
    await renderOverview(overview(), onMonthChange);

    const [previous, next] = screen.getAllByRole("button", {
      name: "admin.ai.overview.budget.show_month",
    });
    if (!previous || !next) throw new Error("The month stepper is missing");
    fireEvent.click(previous);

    expect(onMonthChange).toHaveBeenCalledWith("2026-09");
    expect((next as HTMLButtonElement).disabled).toBe(true);
  });

  it("offers to set a budget when there is none", async () => {
    await renderOverview(overview({}, { limitUsd: null }));

    expect(screen.getByText("admin.ai.overview.budget.no_limit")).toBeTruthy();
    expect(
      screen.queryByRole("img", { name: "admin.ai.overview.budget.meter" }),
    ).toBeNull();
  });

  it("charts and breaks down the number that was picked", async () => {
    await renderOverview(overview());

    expect(
      screen.getByRole("img", {
        name: "admin.ai.overview.chart.budget_title",
      }),
    ).toBeTruthy();

    const runs = screen.getByRole("button", {
      name: /admin\.ai\.overview\.metrics\.runs/,
    });
    fireEvent.click(runs);

    expect(runs.getAttribute("aria-pressed")).toBe("true");
    expect(
      await screen.findByText("admin.ai.overview.chart.running_total"),
    ).toBeTruthy();
    expect(
      within(screen.getByRole("table")).getByRole("columnheader", {
        name: "admin.ai.overview.measure.ops",
      }),
    ).toBeTruthy();
  });
});
