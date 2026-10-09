// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
  NumberFieldScrubArea,
} from "./number-field";

const renderNumberField = (
  props: React.ComponentProps<typeof NumberField> = {},
) =>
  render(
    <NumberField id="amount" {...props}>
      <NumberFieldScrubArea htmlFor="amount" label="Amount" />
      <NumberFieldGroup>
        <NumberFieldDecrement />
        <NumberFieldInput />
        <NumberFieldIncrement />
      </NumberFieldGroup>
    </NumberField>,
  );

const input = () => screen.getByLabelText<HTMLInputElement>("Amount");
const increase = () =>
  screen.getByRole("button", { name: "core.global.increase" });
const decrease = () =>
  screen.getByRole("button", { name: "core.global.decrease" });

const pressButton = (button: HTMLElement) => {
  fireEvent.pointerDown(button, { button: 0, pointerType: "mouse" });
  fireEvent.pointerUp(button, { button: 0, pointerType: "mouse" });
  fireEvent.click(button, { detail: 1 });
};

const changedValues = (onValueChange: ReturnType<typeof vi.fn>) =>
  onValueChange.mock.calls.map(([value]) => value as null | number);

describe("NumberField", () => {
  it("steps up and down by the step with the buttons", () => {
    const onValueChange = vi.fn();
    renderNumberField({ defaultValue: 10, onValueChange, step: 5 });

    pressButton(increase());
    expect(input().value).toBe("15");

    pressButton(decrease());
    pressButton(decrease());
    expect(input().value).toBe("5");
    expect(changedValues(onValueChange)).toEqual([15, 10, 5]);
  });

  it("clamps at min and max and disables the button at the limit", () => {
    const onValueChange = vi.fn();
    renderNumberField({ defaultValue: 9, max: 10, min: 8, onValueChange });

    pressButton(increase());
    expect(input().value).toBe("10");
    expect(increase().hasAttribute("disabled")).toBe(true);

    pressButton(decrease());
    pressButton(decrease());
    expect(input().value).toBe("8");
    expect(decrease().hasAttribute("disabled")).toBe(true);
    expect(changedValues(onValueChange)).toEqual([10, 9, 8]);
  });

  it("steps with the arrow keys and takes the large step with Shift", () => {
    renderNumberField({ defaultValue: 0, max: 25 });

    fireEvent.keyDown(input(), { key: "ArrowUp" });
    expect(input().value).toBe("1");

    fireEvent.keyDown(input(), { key: "ArrowUp", shiftKey: true });
    expect(input().value).toBe("11");

    fireEvent.keyDown(input(), { key: "ArrowUp", shiftKey: true });
    fireEvent.keyDown(input(), { key: "ArrowUp", shiftKey: true });
    expect(input().value).toBe("25");

    fireEvent.keyDown(input(), { key: "ArrowDown" });
    expect(input().value).toBe("24");
  });

  it("commits a typed value on blur, clamped to the range", () => {
    const onValueCommitted = vi.fn();
    renderNumberField({ defaultValue: 1, max: 100, onValueCommitted });

    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: "250" } });
    expect(onValueCommitted).not.toHaveBeenCalled();

    fireEvent.blur(input());
    expect(onValueCommitted).toHaveBeenLastCalledWith(100, expect.anything());
    expect(input().value).toBe("100");
  });

  it("ignores the buttons and the keyboard when disabled", () => {
    const onValueChange = vi.fn();
    renderNumberField({ defaultValue: 3, disabled: true, onValueChange });

    expect(input().disabled).toBe(true);
    expect(increase().hasAttribute("disabled")).toBe(true);
    expect(decrease().hasAttribute("disabled")).toBe(true);

    pressButton(increase());
    fireEvent.keyDown(input(), { key: "ArrowUp" });
    expect(onValueChange).not.toHaveBeenCalled();
    expect(input().value).toBe("3");
  });

  it("keeps a read-only value but leaves the input focusable", () => {
    const onValueChange = vi.fn();
    renderNumberField({ defaultValue: 3, onValueChange, readOnly: true });

    expect(input().readOnly).toBe(true);
    expect(increase().getAttribute("aria-disabled")).toBe("true");

    pressButton(increase());
    fireEvent.keyDown(input(), { key: "ArrowUp" });
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("formats the value with the given Intl options", () => {
    renderNumberField({
      defaultValue: 1234.5,
      format: { currency: "USD", style: "currency" },
      locale: "en-US",
    });

    expect(input().value).toBe("$1,234.50");
  });
});
