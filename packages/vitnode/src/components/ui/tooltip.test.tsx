// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider, TooltipWithContent } from "./tooltip";

const hover = (element: HTMLElement) => {
  fireEvent.pointerEnter(element, { pointerType: "mouse" });
  fireEvent.mouseEnter(element);
  fireEvent.mouseMove(element);
};

const advance = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

describe("TooltipWithContent", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens shortly after hovering without a provider", async () => {
    render(
      <TooltipWithContent text="Delete post">
        <button type="button">Delete</button>
      </TooltipWithContent>,
    );

    hover(screen.getByRole("button", { name: "Delete" }));
    await advance(150);
    expect(screen.queryByText("Delete post")).toBeNull();

    await advance(100);
    expect(screen.getByText("Delete post")).toBeTruthy();
  });

  it("follows the delay of its provider", async () => {
    render(
      <TooltipProvider delay={0}>
        <TooltipWithContent text="Delete post">
          <button type="button">Delete</button>
        </TooltipWithContent>
      </TooltipProvider>,
    );

    hover(screen.getByRole("button", { name: "Delete" }));
    await advance(0);

    expect(screen.getByText("Delete post")).toBeTruthy();
  });
});
