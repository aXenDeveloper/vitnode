// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DateRangeValue } from "./date-range-picker";

import { DateRangePicker } from "./date-range-picker";

const PRESETS = [
  { key: "7d", label: "Last 7 days" },
  { key: "this-month", label: "This month" },
] as const;

const OCTOBER: DateRangeValue = {
  from: new Date(2026, 9, 1),
  to: new Date(2026, 9, 6),
};

const OCTOBER_LABEL = /^Oct 1\s–\s6, 2026$/;

const renderPicker = ({
  activePreset = null,
  onChange = vi.fn(),
  onPresetSelect = vi.fn(),
}: {
  activePreset?: "7d" | "this-month" | null;
  onChange?: (range: DateRangeValue) => void;
  onPresetSelect?: (preset: "7d" | "this-month") => void;
} = {}) =>
  render(
    <DateRangePicker
      activePreset={activePreset}
      endMonth={new Date(2026, 9, 6)}
      onChange={onChange}
      onPresetSelect={onPresetSelect}
      presets={PRESETS}
      value={OCTOBER}
    />,
  );

const dayButton = (grid: HTMLElement, day: string) => {
  const button = grid.querySelector<HTMLButtonElement>(
    `button[data-day='${day}']`,
  );
  if (!button) throw new Error(`No ${day} in the open months`);

  return button;
};

describe("DateRangePicker", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      addEventListener: vi.fn(),
      matches: false,
      media: query,
      removeEventListener: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("names the range by its preset, or by its dates when it has none", () => {
    const { unmount } = renderPicker({ activePreset: "this-month" });

    expect(screen.getByRole("button", { name: "This month" })).toBeDefined();
    unmount();

    renderPicker();

    expect(screen.getByRole("button", { name: OCTOBER_LABEL })).toBeDefined();
  });

  it("applies a preset straight away and closes", async () => {
    const onPresetSelect = vi.fn();
    renderPicker({ onPresetSelect });

    fireEvent.click(screen.getByRole("button", { name: OCTOBER_LABEL }));
    await screen.findByRole("group", { name: "core.global.calendar.presets" });
    fireEvent.click(screen.getByRole("button", { name: "Last 7 days" }));

    expect(onPresetSelect).toHaveBeenCalledWith("7d");
    expect(
      screen.queryByRole("group", { name: "core.global.calendar.presets" }),
    ).toBeNull();
  });

  it("applies a custom range only when it is confirmed", async () => {
    const onChange = vi.fn();
    renderPicker({ onChange });

    fireEvent.click(screen.getByRole("button", { name: OCTOBER_LABEL }));
    const [grid] = await screen.findAllByRole("grid");
    if (!grid) throw new Error("The calendar did not open");
    fireEvent.click(dayButton(grid, "2026-09-12"));
    fireEvent.click(dayButton(grid, "2026-09-25"));

    expect(onChange).not.toHaveBeenCalled();
    expect(
      screen.getByText(/Sep 12\s–\s25, 2026 · core.global.calendar.range_days/),
    ).toBeDefined();

    fireEvent.click(
      screen.getByRole("button", { name: "core.global.calendar.apply_range" }),
    );

    expect(onChange).toHaveBeenCalledWith({
      from: new Date(2026, 8, 12),
      to: new Date(2026, 8, 25),
    });
  });

  it("keeps the old range when the pick is cancelled", async () => {
    const onChange = vi.fn();
    renderPicker({ onChange });

    fireEvent.click(screen.getByRole("button", { name: OCTOBER_LABEL }));
    const [grid] = await screen.findAllByRole("grid");
    if (!grid) throw new Error("The calendar did not open");
    fireEvent.click(dayButton(grid, "2026-09-12"));
    fireEvent.click(screen.getByRole("button", { name: "core.global.cancel" }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: OCTOBER_LABEL })).toBeDefined();
  });
});
