import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./button";

const descriptionOf = (element: HTMLElement) =>
  (element.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .filter(Boolean)
    .map(id => document.getElementById(id)?.textContent)
    .join(" ");

describe("Button disabledTooltip", () => {
  it("shows the reason on hover while disabled", async () => {
    render(
      <Button disabled disabledTooltip="You need the Publish permission">
        Publish
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Publish" });
    fireEvent.mouseEnter(button);
    fireEvent.mouseMove(button);

    const tooltip = await screen.findByText("You need the Publish permission", {
      selector: "[data-slot=tooltip-content]",
    });

    expect(tooltip.isConnected).toBe(true);
  });

  it("stays focusable and describes the reason to assistive tech", () => {
    render(
      <Button disabled disabledTooltip="You need the Publish permission">
        Publish
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Publish" });

    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.hasAttribute("disabled")).toBe(false);
    expect(descriptionOf(button)).toBe("You need the Publish permission");
  });

  it("does not run the click handler while disabled", () => {
    const onClick = vi.fn();
    render(
      <Button disabled disabledTooltip="Not yet" onClick={onClick}>
        Publish
      </Button>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Publish" }));

    expect(onClick).not.toHaveBeenCalled();
  });

  it("ignores the tooltip when the button is enabled", () => {
    render(<Button disabledTooltip="Not yet">Publish</Button>);

    const button = screen.getByRole("button", { name: "Publish" });
    fireEvent.mouseEnter(button);

    expect(descriptionOf(button)).toBe("");
    expect(screen.queryByText("Not yet")).toBeNull();
  });

  it("ignores the tooltip while loading", () => {
    render(
      <Button disabled disabledTooltip="Not yet" isLoading>
        Publish
      </Button>,
    );

    expect(screen.getByRole("button").hasAttribute("disabled")).toBe(true);
    expect(screen.queryByText("Not yet")).toBeNull();
  });
});

describe("Button isLoading", () => {
  it("stays disabled while loading even when disabled is false", () => {
    const onClick = vi.fn();
    render(
      <Button disabled={false} isLoading onClick={onClick}>
        Save
      </Button>,
    );

    const button = screen.getByRole("button");
    fireEvent.click(button);

    expect(button.hasAttribute("disabled")).toBe(true);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("announces loading instead of the passed aria-label", () => {
    render(
      <Button aria-label="Save draft" isLoading>
        Save
      </Button>,
    );

    expect(
      screen.getByRole("button", { name: "core.global.loading" }),
    ).toBeTruthy();
  });

  it("uses the passed aria-label once loading is done", () => {
    render(
      <Button aria-label="Save draft" isLoading={false}>
        Save
      </Button>,
    );

    expect(screen.getByRole("button", { name: "Save draft" })).toBeTruthy();
  });
});
