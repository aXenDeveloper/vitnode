// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { Counter } from "./counter";

const increase = () =>
  screen.getByRole("button", { name: "core.global.increase" });
const decrease = () =>
  screen.getByRole("button", { name: "core.global.decrease" });
const shownValue = () =>
  screen.getByRole("status").querySelector("[data-slot=sliding-number-value]")
    ?.textContent;

describe("Counter", () => {
  it("counts up and down by the step", () => {
    const onValueChange = vi.fn();
    render(<Counter defaultValue={2} onValueChange={onValueChange} step={5} />);

    fireEvent.click(increase());
    expect(onValueChange).toHaveBeenLastCalledWith(7);
    expect(shownValue()).toBe("7");

    fireEvent.click(decrease());
    fireEvent.click(decrease());
    expect(onValueChange).toHaveBeenLastCalledWith(-3);
  });

  it("stops at min and max and disables the button there", () => {
    const onValueChange = vi.fn();
    render(
      <Counter
        defaultValue={1}
        max={2}
        min={0}
        onValueChange={onValueChange}
      />,
    );

    fireEvent.click(increase());
    expect(increase().hasAttribute("disabled")).toBe(true);

    fireEvent.click(decrease());
    fireEvent.click(decrease());
    expect(decrease().hasAttribute("disabled")).toBe(true);
    expect(onValueChange.mock.calls.map(([value]) => value)).toEqual([2, 1, 0]);
  });

  it("clamps a step that would jump past the limit", () => {
    const onValueChange = vi.fn();
    render(
      <Counter
        defaultValue={8}
        max={10}
        onValueChange={onValueChange}
        step={5}
      />,
    );

    fireEvent.click(increase());

    expect(onValueChange).toHaveBeenCalledWith(10);
  });

  it("follows the value prop when controlled", () => {
    const Controlled = () => {
      const [value, setValue] = React.useState(3);

      return (
        <>
          <Counter onValueChange={setValue} value={value} />
          <button onClick={() => setValue(40)} type="button">
            reset
          </button>
        </>
      );
    };
    render(<Controlled />);

    fireEvent.click(increase());
    expect(shownValue()).toBe("4");

    fireEvent.click(screen.getByRole("button", { name: "reset" }));
    expect(shownValue()).toBe("40");
  });

  it("disables both buttons when disabled", () => {
    render(<Counter disabled />);

    expect(increase().hasAttribute("disabled")).toBe(true);
    expect(decrease().hasAttribute("disabled")).toBe(true);
  });
});
