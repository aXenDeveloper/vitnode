// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import { DatePicker } from "./date-picker";

const ControlledDatePicker = ({
  allowClear,
  initial,
}: {
  allowClear?: boolean;
  initial?: Date;
}) => {
  const [value, setValue] = React.useState(initial);

  return (
    <DatePicker allowClear={allowClear} onChange={setValue} value={value} />
  );
};

const openPicker = async (name: RegExp | string) => {
  fireEvent.click(screen.getByRole("button", { name }));

  return await screen.findByRole("grid");
};

describe("DatePicker", () => {
  it("shows the placeholder until a day is picked", async () => {
    render(<ControlledDatePicker />);

    const grid = await openPicker("core.global.calendar.pick_date");
    const firstDay = grid.querySelector<HTMLButtonElement>(
      "button[data-day$='-15']",
    );
    if (!firstDay) throw new Error("No day 15 in the open month");
    fireEvent.click(firstDay);

    expect(
      screen.queryByRole("button", { name: "core.global.calendar.pick_date" }),
    ).toBeNull();
  });

  it("formats the picked date in the active locale", () => {
    render(<ControlledDatePicker initial={new Date(2026, 9, 7)} />);

    expect(
      screen.getByRole("button", { name: "October 7, 2026" }),
    ).toBeDefined();
  });

  it("clears the value when clearing is allowed", async () => {
    render(<ControlledDatePicker allowClear initial={new Date(2026, 9, 7)} />);

    await openPicker("October 7, 2026");
    fireEvent.click(screen.getByRole("button", { name: "core.global.clear" }));

    expect(
      screen.getByRole("button", { name: "core.global.calendar.pick_date" }),
    ).toBeDefined();
  });
});
