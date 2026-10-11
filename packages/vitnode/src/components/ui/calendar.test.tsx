import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Calendar } from "./calendar";

const dayButton = (container: HTMLElement, day: string) => {
  const button = container.querySelector<HTMLButtonElement>(
    `button[data-day="${day}"]`,
  );
  if (!button) throw new Error(`No day button for ${day}`);

  return button;
};

describe("Calendar", () => {
  it("marks the ends and the middle of a selected range", () => {
    const { container } = render(
      <Calendar
        defaultMonth={new Date(2026, 9, 1)}
        mode="range"
        selected={{ from: new Date(2026, 9, 5), to: new Date(2026, 9, 9) }}
      />,
    );

    expect(dayButton(container, "2026-10-05").dataset.rangeStart).toBe("true");
    expect(dayButton(container, "2026-10-07").dataset.rangeMiddle).toBe("true");
    expect(dayButton(container, "2026-10-09").dataset.rangeEnd).toBe("true");
  });

  it("moves between months with translated navigation buttons", () => {
    render(<Calendar defaultMonth={new Date(2026, 9, 1)} />);

    fireEvent.click(
      screen.getByRole("button", { name: "core.global.calendar.next_month" }),
    );

    expect(screen.getByText("November 2026")).toBeDefined();
  });

  it("names the month and weekdays in the active locale", () => {
    const { container } = render(
      <Calendar defaultMonth={new Date(2026, 9, 1)} />,
    );

    expect(screen.getByText("October 2026")).toBeDefined();
    expect(
      [...container.querySelectorAll("th")].map(header => header.textContent),
    ).toEqual(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
  });
});
