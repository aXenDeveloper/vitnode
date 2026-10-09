// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { IntlProvider } from "use-intl";
import { describe, expect, it, vi } from "vitest";

import { AiSuggestionBody } from "./ai-field-assist";

const renderBody = (props: Partial<Parameters<typeof AiSuggestionBody>[0]>) => {
  const handlers = {
    onAccept: vi.fn(),
    onDiscard: vi.fn(),
    onGenerate: vi.fn(),
  };
  render(
    <IntlProvider locale="en" messages={{}} timeZone="UTC">
      <AiSuggestionBody
        missingSources={[]}
        pending={false}
        staleSource={false}
        suggestion={null}
        targetEdited={false}
        {...handlers}
        {...props}
      />
    </IntlProvider>,
  );

  return handlers;
};

describe("AiSuggestionBody", () => {
  it("asks for a suggestion first, and only when the sources are filled", () => {
    const { onGenerate } = renderBody({});
    fireEvent.click(
      screen.getByRole("button", { name: "core.global.ai_assist.generate" }),
    );
    expect(onGenerate).toHaveBeenCalledOnce();
  });

  it("disables generating while a source field is empty", () => {
    renderBody({ missingSources: ["title"] });

    expect(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "core.global.ai_assist.generate",
      }).disabled,
    ).toBe(true);
    expect(
      screen.getByText("core.global.ai_assist.missing_sources"),
    ).toBeTruthy();
  });

  it("shows the suggestion for review and lets the editor accept or discard it", () => {
    const { onAccept, onDiscard } = renderBody({
      suggestion: "A short teaser.",
    });

    expect(screen.getByText("A short teaser.")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "core.global.ai_assist.accept" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "core.global.ai_assist.discard" }),
    );
    expect(onAccept).toHaveBeenCalledOnce();
    expect(onDiscard).toHaveBeenCalledOnce();
  });

  it("warns about stale sources and asks before replacing a newer edit", () => {
    renderBody({ staleSource: true, suggestion: "Teaser", targetEdited: true });

    expect(screen.getByText("core.global.ai_assist.stale_source")).toBeTruthy();
    expect(
      screen.getByText("core.global.ai_assist.target_edited"),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: "core.global.ai_assist.replace_anyway",
      }),
    ).toBeTruthy();
  });

  it("announces generation progress", () => {
    renderBody({ pending: true });

    expect(screen.getByText("core.global.ai_assist.generating")).toBeTruthy();
  });
});
