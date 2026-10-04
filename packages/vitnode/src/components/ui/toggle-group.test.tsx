import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ToggleGroup, ToggleGroupItem } from "./toggle-group";

const indicatorIn = (element: HTMLElement) =>
  element.querySelector("[data-slot=toggle-group-indicator]");

describe("ToggleGroup selection indicator", () => {
  it("draws one indicator inside the pressed item and moves it on press", () => {
    render(
      <ToggleGroup defaultValue={["day"]}>
        <ToggleGroupItem value="day">Day</ToggleGroupItem>
        <ToggleGroupItem value="week">Week</ToggleGroupItem>
      </ToggleGroup>,
    );

    const day = screen.getByRole("button", { name: "Day" });
    const week = screen.getByRole("button", { name: "Week" });

    expect(indicatorIn(day)).not.toBeNull();
    expect(indicatorIn(week)).toBeNull();

    fireEvent.click(week);

    expect(week.getAttribute("aria-pressed")).toBe("true");
    expect(indicatorIn(week)).not.toBeNull();
    expect(indicatorIn(day)).toBeNull();
  });

  it("keeps per-item fills without an indicator when multiple is set", () => {
    render(
      <ToggleGroup defaultValue={["bold", "italic"]} multiple>
        <ToggleGroupItem value="bold">Bold</ToggleGroupItem>
        <ToggleGroupItem value="italic">Italic</ToggleGroupItem>
      </ToggleGroup>,
    );

    expect(
      document.querySelector("[data-slot=toggle-group-indicator]"),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Bold" }).getAttribute("aria-pressed"),
    ).toBe("true");
  });
});
