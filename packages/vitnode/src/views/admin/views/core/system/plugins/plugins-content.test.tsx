import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { IntlProvider } from "use-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  AdminInstalledPlugin,
  AdminInstalledPlugins,
} from "./plugins-query";

import { PluginsContent } from "./plugins-content";

const plugin = (
  overrides: Partial<AdminInstalledPlugin> = {},
): AdminInstalledPlugin => ({
  description: "Posts and categories",
  icon: null,
  id: "@acme/blog",
  registrations: {
    api: { version: "1.0.0" },
    frontend: { version: "1.0.0" },
  },
  title: "Blog",
  version: "1.0.0",
  versionMismatch: false,
  ...overrides,
});

const forum = plugin({
  description: "Threads and replies",
  id: "@acme/forum",
  registrations: {
    api: { version: "2.0.0" },
    frontend: { version: "1.0.0" },
  },
  title: "Forum",
  version: "2.0.0",
  versionMismatch: true,
});

const renderPlugins = (data: Partial<AdminInstalledPlugins> = {}) =>
  render(
    <IntlProvider locale="en" messages={{}} timeZone="UTC">
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <PluginsContent
          data={{
            core: { version: "2.0.0" },
            frontendInventory: true,
            plugins: [plugin(), forum],
            ...data,
          }}
        />
      </QueryClientProvider>
    </IntlProvider>,
  );

const search = async (value: string) => {
  fireEvent.change(screen.getByRole("searchbox"), { target: { value } });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });
};

afterEach(() => {
  vi.useRealTimers();
});

describe("PluginsContent", () => {
  it("narrows the list as you search, and clears a search with no results", async () => {
    vi.useFakeTimers();
    renderPlugins();

    await search("threads");
    expect(screen.queryByText("Blog")).toBeNull();
    expect(screen.getByText("Forum")).toBeTruthy();

    await search("nothing like this");
    expect(screen.queryByText("Forum")).toBeNull();
    expect(
      screen.getByText("admin.system.plugins.no_results.title"),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", {
        name: "admin.system.plugins.no_results.clear",
      }),
    );
    expect(screen.getByText("Blog")).toBeTruthy();
    expect(screen.getByText("Forum")).toBeTruthy();
  });

  it("says no plugins are installed when there are none", () => {
    renderPlugins({ plugins: [] });

    expect(screen.getByText("admin.system.plugins.empty.title")).toBeTruthy();
    expect(
      screen.queryByText("admin.system.plugins.no_results.title"),
    ).toBeNull();
  });

  it("warns only about the plugin whose API and frontend versions differ", () => {
    renderPlugins();

    expect(screen.getAllByText("admin.system.plugins.mismatch")).toHaveLength(
      1,
    );
  });

  it("marks a plugin with no known version", () => {
    renderPlugins({ plugins: [plugin({ version: null })] });

    expect(
      screen.getByText("admin.system.plugins.version_unknown"),
    ).toBeTruthy();
  });

  it("shows the default icon for a plugin that names none", () => {
    const { container } = renderPlugins({ plugins: [plugin({ icon: null })] });

    expect(screen.getByText("Blog")).toBeTruthy();
    expect(container.querySelector("svg.lucide-puzzle")).not.toBeNull();
  });
});
