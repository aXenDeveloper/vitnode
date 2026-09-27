import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LanguagesProvider } from "@/components/languages-provider";

import type { HeaderNavItem } from "../header-nav";
import type { UserHeaderState } from "../user/user-header-model";

import { MobileUserMenuContent } from "./mobile-user-menu";

const navigation: HeaderNavItem[] = [
  { href: "/", icon: "emoji:🏠", id: "1", label: "Home" },
  { href: "/search", id: "2", label: "Search" },
  {
    href: "/community",
    id: "3",
    items: [{ href: "/community/blog", id: "31", label: "Blog" }],
    label: "Community",
  },
];

const signedIn: UserHeaderState = {
  status: "authenticated",
  user: {
    avatarColor: "abcdef",
    email: "ada@example.com",
    isAdmin: false,
    name: "Ada",
    nameCode: "ada",
  },
};

const mount = async (
  props: Partial<React.ComponentProps<typeof MobileUserMenuContent>> = {},
) => {
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ["/"] }),
    routeTree: createRootRoute({
      component: () => (
        <MobileUserMenuContent
          currentLocale="en"
          navigation={navigation}
          onSelectLocale={vi.fn()}
          onSignOut={vi.fn()}
          state={{ status: "anonymous" }}
          {...props}
        />
      ),
    }),
  });

  await act(async () => {
    await router.load();
  });
  render(
    <LanguagesProvider
      languages={[
        { code: "en", name: "English" },
        { code: "pl", name: "Polski" },
        { code: "de", name: "Deutsch" },
      ]}
    >
      <RouterProvider router={router} />
    </LanguagesProvider>,
  );
};

const openMenu = async () => {
  fireEvent.click(
    await screen.findByRole("button", { name: "core.global.mobile_nav.menu" }),
  );

  return await screen.findByRole("dialog");
};

describe("the mobile user menu", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        disconnect() {}
        observe() {}
      },
    );
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        addEventListener: vi.fn(),
        addListener: vi.fn(),
        matches: false,
        removeEventListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows a skeleton while the session loads", async () => {
    await mount({ state: { status: "loading" } });

    expect(
      screen.queryByRole("button", { name: "core.global.mobile_nav.menu" }),
    ).toBeNull();
  });

  it("closes from its close button", async () => {
    await mount();

    const drawer = await openMenu();
    fireEvent.click(
      within(drawer).getByRole("button", { name: "core.global.close" }),
    );

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("opens a drawer with the full navigation, children included", async () => {
    await mount();

    const drawer = await openMenu();

    expect(
      within(drawer).getByRole("link", { name: "Community" }),
    ).toBeTruthy();
    expect(within(drawer).getByRole("link", { name: "Blog" })).toBeTruthy();
  });

  it("leaves the navigation to the bottom bar when it has one", async () => {
    await mount({ hasNavigation: false });

    const drawer = await openMenu();

    expect(
      within(drawer).queryByRole("link", { name: "Community" }),
    ).toBeNull();
    expect(
      within(drawer).getByRole("link", { name: "core.global.login" }),
    ).toBeTruthy();
  });

  it("offers sign in and sign up to a guest", async () => {
    await mount();

    const drawer = await openMenu();

    expect(
      within(drawer).getByRole("link", { name: "core.global.login" }),
    ).toBeTruthy();
    expect(
      within(drawer).getByRole("link", { name: "core.global.register" }),
    ).toBeTruthy();
    expect(
      within(drawer).queryByRole("button", {
        name: "core.global.user_bar.log_out",
      }),
    ).toBeNull();
  });

  it("shows the member's identity and account links", async () => {
    await mount({ state: signedIn });

    const drawer = await openMenu();

    expect(within(drawer).getByText("ada@example.com")).toBeTruthy();
    expect(
      within(drawer).getByRole("link", {
        name: "core.global.user_bar.settings",
      }),
    ).toBeTruthy();
    expect(
      within(drawer).queryByRole("link", {
        name: /core.global.user_bar.admin_cp/,
      }),
    ).toBeNull();
    expect(
      within(drawer).queryByRole("link", { name: "core.global.login" }),
    ).toBeNull();
  });

  it("signs out and closes the drawer", async () => {
    const onSignOut = vi.fn();
    await mount({ onSignOut, state: signedIn });

    const drawer = await openMenu();
    fireEvent.click(
      within(drawer).getByRole("button", {
        name: "core.global.user_bar.log_out",
      }),
    );

    expect(onSignOut).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("switches the language from a select that lists every language", async () => {
    const onSelectLocale = vi.fn();
    await mount({ onSelectLocale });

    const drawer = await openMenu();
    const select = within(drawer).getByLabelText<HTMLSelectElement>(
      "core.global.language",
    );

    expect(select.value).toBe("en");
    expect(
      within(select)
        .getAllByRole("option")
        .map(option => option.textContent),
    ).toEqual(["English", "Polski", "Deutsch"]);

    fireEvent.change(select, { target: { value: "de" } });

    expect(onSelectLocale).toHaveBeenCalledWith("de");
  });

  it("shows the theme choices with their icons", async () => {
    await mount();

    const drawer = await openMenu();
    const group = within(drawer).getByRole("group", {
      name: "core.global.theme.label",
    });

    expect(
      within(group)
        .getAllByRole("button")
        .map(button => button.textContent),
    ).toEqual([
      "core.global.theme.light",
      "core.global.theme.dark",
      "core.global.theme.system",
    ]);
    expect(group.querySelectorAll("svg")).toHaveLength(3);
  });
});
