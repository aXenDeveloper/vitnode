import { fireEvent, render, screen } from "@testing-library/react";
import { IntlProvider } from "use-intl";
import { describe, expect, it, vi } from "vitest";

import { QuickAskPanel } from "./quick-ask-action";

const renderPanel = (
  props: Partial<Parameters<typeof QuickAskPanel>[0]> = {},
) => {
  const handlers = {
    onApply: vi.fn(),
    onDiscard: vi.fn(),
    onInstruction: vi.fn(),
    onRun: vi.fn(),
    onStop: vi.fn(),
  };
  render(
    <IntlProvider locale="en" messages={{}} timeZone="UTC">
      <QuickAskPanel
        canAsk
        canRewrite
        estimate={null}
        instruction=""
        phase={{ kind: "idle" }}
        stale={false}
        {...handlers}
        {...props}
      />
    </IntlProvider>,
  );

  return handlers;
};

const button = (name: string) => screen.getByRole("button", { name });

describe("QuickAskPanel", () => {
  it("offers the rewrite operations and runs the one clicked", () => {
    const { onRun } = renderPanel();

    fireEvent.click(button("core.global.ai_assist.quick_ask.operation.shorten"));
    fireEvent.click(button("core.global.ai_assist.quick_ask.tones.formal"));

    expect(onRun).toHaveBeenNthCalledWith(1, {
      kind: "rewrite",
      operation: "shorten",
    });
    expect(onRun).toHaveBeenNthCalledWith(2, {
      kind: "rewrite",
      operation: "tone",
      tone: "formal",
    });
  });

  it("shows the bound before anything runs", () => {
    renderPanel({ estimate: "12.5" });

    expect(screen.getByText("core.global.ai_assist.quick_ask.estimate")).toBeTruthy();
  });

  it("sends a custom request only with an instruction", () => {
    const { onRun } = renderPanel({ instruction: "Make a list" });

    fireEvent.click(button("core.global.ai_assist.quick_ask.ask"));

    expect(onRun).toHaveBeenCalledWith({
      instruction: "Make a list",
      kind: "custom",
    });
  });

  it("can stop a streaming answer", () => {
    const { onStop } = renderPanel({
      phase: { kind: "streaming", text: "Partial" },
    });

    expect(screen.getByText("Partial")).toBeTruthy();
    fireEvent.click(button("core.global.ai_assist.quick_ask.stop"));
    expect(onStop).toHaveBeenCalledOnce();
  });

  it("offers replace, insert below and discard for a result", () => {
    const { onApply, onDiscard } = renderPanel({
      phase: { kind: "result", runId: 1, text: "Shorter." },
    });

    fireEvent.click(button("core.global.ai_assist.quick_ask.replace"));
    fireEvent.click(button("core.global.ai_assist.quick_ask.insert_below"));
    fireEvent.click(button("core.global.ai_assist.quick_ask.discard"));

    expect(onApply.mock.calls).toEqual([["replace"], ["below"]]);
    expect(onDiscard).toHaveBeenCalledOnce();
  });

  it("refuses to replace text that changed during generation", () => {
    renderPanel({
      phase: { kind: "result", runId: 1, text: "Shorter." },
      stale: true,
    });

    expect(screen.getByText("core.global.ai_assist.quick_ask.stale")).toBeTruthy();
    expect(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "core.global.ai_assist.quick_ask.replace",
      }).disabled,
    ).toBe(true);
  });
});
