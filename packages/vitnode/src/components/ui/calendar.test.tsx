import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Calendar } from "./calendar";

const dayButton = (container: HTMLElement, day: string) => {
  const button = container.querySelector<HTMLButtonElement>(
    `button[data-day="${day}"]`,
  );
  if (!button) throw new Error(`No day button for ${day}`);

  return button;
};

describe("Calendar", () => {
  it("selects a single day on click", () => {
    const onSelect = vi.fn();
    const { container } = render(
      <Calendar
        defaultMonth={new Date(2026, 9, 1)}
        mode="single"
        onSelect={onSelect}
      />,
    );

    fireEvent.click(dayButton(container, "2026-10-07"));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0]).toEqual(new Date(2026, 9, 7));
  });

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

  it("does not select a disabled day", () => {
    const onSelect = vi.fn();
    const { container } = render(
      <Calendar
        defaultMonth={new Date(2026, 9, 1)}
        disabled={{ dayOfWeek: [0, 6] }}
        mode="single"
        onSelect={onSelect}
      />,
    );

    const saturday = dayButton(container, "2026-10-10");
    fireEvent.click(saturday);

    expect(saturday.disabled).toBe(true);
    expect(onSelect).not.toHaveBeenCalled();
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
