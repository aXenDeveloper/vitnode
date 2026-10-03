import { act, fireEvent, render, screen } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CopyButton } from "./copy-button";

const stubClipboard = (writeText: (text: string) => Promise<void>) => {
  const spy = vi.fn(writeText);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: spy },
  });

  return spy;
};

const clickAndFlush = async (element: HTMLElement) => {
  await act(async () => {
    fireEvent.click(element);
    await Promise.resolve();
  });
};

describe("CopyButton", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("writes the content to the clipboard and announces it", async () => {
    const writeText = stubClipboard(async () => {});
    render(<CopyButton content="pnpm create vitnode-app" />);

    await clickAndFlush(
      screen.getByRole("button", { name: "core.global.copy" }),
    );

    expect(writeText).toHaveBeenCalledWith("pnpm create vitnode-app");
    expect(
      screen.getByRole("button", { name: "core.global.copied" }),
    ).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("core.global.copied");
  });

  it("goes back to the copy state after the delay", async () => {
    stubClipboard(async () => {});
    const onCopiedChange = vi.fn();
    render(
      <CopyButton
        content="hello"
        delay={1000}
        onCopiedChange={onCopiedChange}
      />,
    );

    await clickAndFlush(screen.getByRole("button"));
    expect(onCopiedChange).toHaveBeenLastCalledWith(true);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(onCopiedChange).toHaveBeenLastCalledWith(false);
    expect(
      screen.getByRole("button", { name: "core.global.copy" }),
    ).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("shows an error toast when the clipboard rejects", async () => {
    stubClipboard(async () => Promise.reject(new Error("denied")));
    const toastError = vi.spyOn(toast, "error");
    render(<CopyButton content="hello" />);

    await clickAndFlush(screen.getByRole("button"));

    expect(toastError).toHaveBeenCalledWith("core.global.errors.title", {
      description: "core.global.copy_failed",
    });
    expect(
      screen.getByRole("button", { name: "core.global.copy" }),
    ).toBeTruthy();
  });

  it("keeps a visible label as the accessible name", async () => {
    stubClipboard(async () => {});
    render(<CopyButton content="hello">Copy command</CopyButton>);

    await clickAndFlush(screen.getByRole("button", { name: "Copy command" }));

    expect(screen.getByRole("button", { name: "Copy command" })).toBeTruthy();
  });

  it("does not copy when the click handler prevents default", async () => {
    const writeText = stubClipboard(async () => {});
    render(
      <CopyButton
        content="hello"
        onClick={event => {
          event.preventDefault();
        }}
      />,
    );

    await clickAndFlush(screen.getByRole("button"));

    expect(writeText).not.toHaveBeenCalled();
  });
});
