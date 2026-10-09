import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { IntlProvider } from "use-intl";
import { describe, expect, it, vi } from "vitest";

import type { AdminAiAction } from "../ai-query";

import { AiActionsContent } from "./actions-content";

const action = (overrides: Partial<AdminAiAction> = {}): AdminAiAction => ({
  actors: ["user"],
  compatibleModelIds: ["default"],
  defaults: {
    dailyLimit: null,
    maxImages: 0,
    maxInputCharacters: 1_000,
    maxOutputTokens: 100,
    maxRetries: 0,
    maxSteps: 1,
    timeoutMs: 10_000,
  },
  description: "Writes a short excerpt for an article.",
  icon: null,
  key: "@vitnode/blog:excerpt.generate",
  localId: "excerpt.generate",
  output: "text",
  permission: { defaultGranted: false, key: "@vitnode/blog:excerpt" },
  pluginId: "@vitnode/blog",
  promptVersion: 1,
  requiredCapabilities: ["text"],
  settings: {
    dailyLimit: null,
    enabled: true,
    fallbackModelId: null,
    instructions: null,
    maxInputCharacters: null,
    maxOutputTokens: null,
    maxRetries: null,
    maxSteps: null,
    modelId: null,
    timeoutMs: null,
  },
  title: "Generate excerpt",
  ...overrides,
});

const quickAsk = action({
  description: "Answers a short request about the selected text.",
  key: "@vitnode/core:editor.quick-ask",
  localId: "editor.quick-ask",
  pluginId: "@vitnode/core",
  title: "Quick Ask",
});

const renderActions = (
  actions: AdminAiAction[],
  {
    canManage = true,
    onSave = vi.fn(async () => Promise.resolve({ data: true as const })),
  } = {},
) =>
  render(
    <IntlProvider locale="en" messages={{}} timeZone="UTC">
      <AiActionsContent
        actions={actions}
        canManage={canManage}
        models={[]}
        onSave={onSave}
      />
    </IntlProvider>,
  );

describe("AiActionsContent", () => {
  it("lists every action with its title, description and plugin", () => {
    renderActions([action(), quickAsk]);

    expect(screen.getByText("Generate excerpt")).toBeTruthy();
    expect(
      screen.getByText("Writes a short excerpt for an article."),
    ).toBeTruthy();
    expect(screen.getByText("@vitnode/blog")).toBeTruthy();
    expect(screen.getByText("Quick Ask")).toBeTruthy();
    expect(screen.getByText("@vitnode/core")).toBeTruthy();
  });

  it("offers configuring, never a test run", () => {
    renderActions([action()]);

    expect(
      screen.getByRole("button", { name: "admin.ai.actions.form.open_label" }),
    ).toBeTruthy();
    expect(screen.queryByText(/test/i)).toBeNull();
  });

  it("hides configuring from admins who may only view", () => {
    renderActions([action()], { canManage: false });

    expect(
      screen.queryByRole("button", {
        name: "admin.ai.actions.form.open_label",
      }),
    ).toBeNull();
  });

  it("says an action has no model it can run on", () => {
    renderActions([action({ compatibleModelIds: [] })]);

    expect(screen.getByText("admin.ai.actions.no_compatible")).toBeTruthy();
  });

  it("finds actions by title as you type", async () => {
    renderActions([action(), quickAsk]);

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "quick" },
    });

    await waitFor(() => {
      expect(screen.queryByText("Generate excerpt")).toBeNull();
    });
    expect(screen.getByText("Quick Ask")).toBeTruthy();
  });

  it("groups actions under the plugin that registers them", () => {
    renderActions([action(), quickAsk]);

    const blog = screen
      .getAllByRole("rowgroup")
      .find(group =>
        within(group).queryByRole("rowheader", { name: /@vitnode\/blog/ }),
      );
    if (!blog) throw new Error("No @vitnode/blog group");
    expect(within(blog).getByText("Generate excerpt")).toBeTruthy();
    expect(within(blog).queryByText("Quick Ask")).toBeNull();
  });

  it("switches an action off right from the list", async () => {
    const onSave = vi.fn(async () => Promise.resolve({ data: true as const }));
    renderActions([action()], { onSave });

    fireEvent.click(
      screen.getByRole("switch", { name: "admin.ai.actions.toggle_label" }),
    );

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: false,
          key: "@vitnode/blog:excerpt.generate",
        }),
      );
    });
  });

  it("offers to clear a search that matches nothing", async () => {
    renderActions([action()]);

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "nothing like this" },
    });
    fireEvent.click(
      await screen.findByRole("button", {
        name: "admin.ai.actions.no_results.clear",
      }),
    );

    expect(screen.getByText("Generate excerpt")).toBeTruthy();
  });
});
