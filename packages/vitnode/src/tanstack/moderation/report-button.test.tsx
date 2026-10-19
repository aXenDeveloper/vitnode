import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { sessionQueryOptions } from "../auth/session-query";
import { configureIntl, resetIntlRuntime } from "../i18n";
import { ReportButton, ReportDialog } from "./report-button";

const TARGET = { id: "1", pluginId: "@vitnode/forum", type: "forum.topic" };

const mount = (ui: React.ReactNode) => {
  const queryClient = new QueryClient();
  queryClient.setQueryData(sessionQueryOptions().queryKey, { user: null });

  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ["/topics/1?page=2"] }),
    routeTree: createRootRoute({ component: () => ui }),
  });

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  configureIntl({
    fetchMessages: async () =>
      await Promise.resolve({ locale: "en", messages: {} }),
    i18n: { defaultLocale: "en", locales: [{ code: "en", name: "English" }] },
  });
});

afterEach(() => {
  resetIntlRuntime();
});

describe("ReportButton", () => {
  it("names the item it reports and points at its description", async () => {
    mount(
      <>
        <h2 id="topic-1-title">Topic</h2>
        <ReportButton
          describedBy="topic-1-title"
          target={TARGET}
          typeLabel="topic"
        />
      </>,
    );

    const button = await screen.findByRole("button", {
      name: "core.moderation.report.title",
    });
    expect(button.getAttribute("aria-haspopup")).toBe("dialog");
    expect(button.getAttribute("aria-describedby")).toBe("topic-1-title");
  });

  it("opens a dialog that sends a guest to sign in and back", async () => {
    mount(<ReportButton target={TARGET} typeLabel="topic" />);
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(
      await screen.findByRole("button", {
        name: "core.moderation.report.title",
      }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("core.moderation.report.signed_out");
    const signIn = screen.getByRole("link", {
      name: "core.moderation.report.sign_in",
    });
    const href = new URL(
      signIn.getAttribute("href") ?? "",
      "https://vitnode.invalid",
    );
    expect(href.pathname).toBe("/login");
    expect(href.searchParams.get("returnTo")).toBe("/topics/1?page=2");
  });
});

describe("ReportDialog", () => {
  it.each([
    [false, 0],
    [true, 1],
  ])("with open=%s renders %i dialogs", async (open, dialogs) => {
    mount(
      <>
        <ReportButton target={TARGET} typeLabel="topic" />
        <ReportDialog
          onOpenChange={() => undefined}
          open={open}
          target={TARGET}
          typeLabel="topic"
        />
      </>,
    );
    // Both load the same messages, so the button showing means the dialog has too.
    await screen.findByRole("button", { name: "core.moderation.report.title" });
    if (open) await screen.findByRole("dialog");

    expect(screen.queryAllByRole("dialog")).toHaveLength(dialogs);
  });
});
