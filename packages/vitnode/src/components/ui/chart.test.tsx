import type { ChartPoint } from "@tanstack/charts";

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ChartConfig } from "./chart";

import { ChartContainer, ChartLegend, ChartTooltipContent } from "./chart";

const config = {
  threads: { label: "Threads" },
  desktop: { label: "Desktop", color: "var(--chart-1)" },
  mobile: { label: "Mobile", color: "var(--chart-2)" },
} satisfies ChartConfig;

const point = (overrides: Partial<ChartPoint>): ChartPoint => ({
  color: "var(--color-desktop)",
  datum: {},
  datumIndex: 0,
  group: null,
  groupLabel: "line-0",
  key: `${overrides.groupLabel ?? "line-0"}:${String(overrides.xValue)}`,
  markId: "line-0",
  x: 0,
  xValue: "January",
  y: 0,
  yValue: 0,
  ...overrides,
});

describe("ChartTooltipContent", () => {
  it("names each series from the config and shows its value", () => {
    render(
      <ChartContainer config={config}>
        <ChartTooltipContent
          points={[
            point({ group: "desktop", groupLabel: "desktop", yValue: 1860 }),
            point({ group: "mobile", groupLabel: "mobile", yValue: 80 }),
          ]}
        />
      </ChartContainer>,
    );

    expect(screen.getByText("January")).toBeDefined();
    expect(screen.getByText("Desktop")).toBeDefined();
    expect(screen.getByText((1860).toLocaleString())).toBeDefined();
    expect(screen.getByText("Mobile")).toBeDefined();
    expect(screen.getByText("80")).toBeDefined();
  });

  it("reads the name and value from row fields for pie slices", () => {
    render(
      <ChartContainer config={config}>
        <ChartTooltipContent
          hideLabel
          nameKey="category"
          points={[
            point({
              datum: { category: "mobile", threads: 286 },
              xValue: 1.85,
              yValue: 80,
            }),
          ]}
          valueKey="threads"
        />
      </ChartContainer>,
    );

    expect(screen.getByText("Mobile")).toBeDefined();
    expect(screen.getByText("286")).toBeDefined();
    expect(screen.queryByText("80")).toBeNull();
  });

  it("falls back to nameKey as a config key for a single series", () => {
    render(
      <ChartContainer config={config}>
        <ChartTooltipContent
          nameKey="threads"
          points={[point({ datum: { threads: 412 }, yValue: 412 })]}
        />
      </ChartContainer>,
    );

    expect(screen.getByText("Threads")).toBeDefined();
  });

  it("renders rows with a custom formatter", () => {
    render(
      <ChartContainer config={config}>
        <ChartTooltipContent
          formatter={(value, name) => (
            <span>
              {name}: {String(value)} visits
            </span>
          )}
          points={[
            point({ group: "desktop", groupLabel: "desktop", yValue: 12 }),
          ]}
        />
      </ChartContainer>,
    );

    expect(screen.getByText("Desktop: 12 visits")).toBeDefined();
  });
});

describe("ChartLegend", () => {
  it("lists every colored config entry", () => {
    render(
      <ChartContainer config={config}>
        <ChartLegend />
      </ChartContainer>,
    );

    const items = within(screen.getByRole("list")).getAllByRole("listitem");

    expect(items.map(item => item.textContent)).toEqual(["Desktop", "Mobile"]);
  });

  it("shows only the requested keys in order", () => {
    render(
      <ChartContainer config={config}>
        <ChartLegend keys={["mobile"]} />
      </ChartContainer>,
    );

    expect(
      within(screen.getByRole("list"))
        .getAllByRole("listitem")
        .map(item => item.textContent),
    ).toEqual(["Mobile"]);
  });
});
