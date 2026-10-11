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

  it("restarts the delay when clicked again while copied", async () => {
    stubClipboard(async () => {});
    render(<CopyButton content="hello" delay={1000} />);

    await clickAndFlush(screen.getByRole("button"));
    act(() => {
      vi.advanceTimersByTime(600);
    });
    await clickAndFlush(screen.getByRole("button"));
    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(
      screen.getByRole("button", { name: "core.global.copied" }),
    ).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(
      screen.getByRole("button", { name: "core.global.copy" }),
    ).toBeTruthy();
  });

  it("goes back to the copy state after two seconds by default", async () => {
    stubClipboard(async () => {});
    render(<CopyButton content="hello" />);

    await clickAndFlush(screen.getByRole("button"));
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(
      screen.getByRole("button", { name: "core.global.copy" }),
    ).toBeTruthy();
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

  it("copies text resolved from async content", async () => {
    const writeText = stubClipboard(async () => {});
    render(<CopyButton content={async () => "# Page"} />);

    await clickAndFlush(screen.getByRole("button"));
    await act(async () => {
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith("# Page");
    expect(
      screen.getByRole("button", { name: "core.global.copied" }),
    ).toBeTruthy();
  });

  it("copies text read lazily from a synchronous content function", async () => {
    const writeText = stubClipboard(async () => {});
    let markup = "<svg />";
    render(<CopyButton content={() => markup} />);
    markup = "<svg>tabby</svg>";

    await clickAndFlush(screen.getByRole("button"));

    expect(writeText).toHaveBeenCalledWith("<svg>tabby</svg>");
  });

  it("hands a pending clipboard item to the clipboard when supported", async () => {
    class FakeClipboardItem {
      readonly items: Record<string, Promise<Blob>>;

      constructor(items: Record<string, Promise<Blob>>) {
        this.items = items;
      }
    }
    vi.stubGlobal("ClipboardItem", FakeClipboardItem);
    const write = vi.fn(async (_items: FakeClipboardItem[]) => {});
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { write, writeText: vi.fn() },
    });
    render(<CopyButton content={async () => "# Page"} />);

    await clickAndFlush(screen.getByRole("button"));

    expect(write).toHaveBeenCalledTimes(1);
    const [item] = write.mock.calls[0][0];
    const blob = await item.items["text/plain"];
    expect(await blob.text()).toBe("# Page");
    vi.unstubAllGlobals();
  });

  it("shows an error toast when async content fails", async () => {
    const writeText = stubClipboard(async () => {});
    const toastError = vi.spyOn(toast, "error");
    render(
      <CopyButton
        content={async () => Promise.reject(new Error("Not Found"))}
      />,
    );

    await clickAndFlush(screen.getByRole("button"));
    await act(async () => {
      await Promise.resolve();
    });

    expect(writeText).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("core.global.errors.title", {
      description: "core.global.copy_failed",
    });
  });

  it("ignores clicks while async content is loading", async () => {
    stubClipboard(async () => {});
    let resolveContent: (value: string) => void = () => {};
    const content = vi.fn(
      async () =>
        new Promise<string>(resolve => {
          resolveContent = resolve;
        }),
    );
    render(<CopyButton content={content} />);

    await clickAndFlush(screen.getByRole("button"));
    expect(screen.getByRole("button").getAttribute("aria-busy")).toBe("true");
    await clickAndFlush(screen.getByRole("button"));

    expect(content).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveContent("done");
      await Promise.resolve();
    });

    expect(screen.getByRole("button").getAttribute("aria-busy")).toBeNull();
  });
});
