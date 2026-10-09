// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "../../theme-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import { ThemeSegmentedControl } from "./theme-segmented-control";
import { ThemeSwitcherMenu } from "./theme-switcher-menu";

const withTheme = (children: React.ReactNode) => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    {children}
  </ThemeProvider>
);

describe("theme switchers", () => {
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
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  describe("the segmented control", () => {
    it("presses the current theme and moves to the one clicked", () => {
      render(withTheme(<ThemeSegmentedControl />));

      const system = screen.getByRole("button", {
        name: "core.global.theme.system",
      });
      const dark = screen.getByRole("button", {
        name: "core.global.theme.dark",
      });

      expect(system.getAttribute("aria-pressed")).toBe("true");

      fireEvent.click(dark);

      expect(dark.getAttribute("aria-pressed")).toBe("true");
      expect(system.getAttribute("aria-pressed")).toBe("false");
    });
  });

  describe("inside a dropdown", () => {
    const openMenu = async () => {
      render(
        withTheme(
          <DropdownMenu>
            <DropdownMenuTrigger>Open</DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Profile</DropdownMenuItem>
              <ThemeSwitcherMenu />
            </DropdownMenuContent>
          </DropdownMenu>,
        ),
      );
      fireEvent.click(screen.getByRole("button", { name: "Open" }));

      return await screen.findByRole("menu");
    };

    it("shows all three themes inline, with the current one checked", async () => {
      const menu = await openMenu();

      const group = within(menu).getByRole("group", {
        name: "core.global.theme.label",
      });
      const items = within(group).getAllByRole("menuitemradio");

      expect(items.map(item => item.textContent)).toEqual([
        "core.global.theme.light",
        "core.global.theme.dark",
        "core.global.theme.system",
      ]);
      expect(items[2].getAttribute("aria-checked")).toBe("true");
    });

    it("switches the theme and keeps the menu open", async () => {
      const menu = await openMenu();

      fireEvent.click(
        within(menu).getByRole("menuitemradio", {
          name: "core.global.theme.dark",
        }),
      );

      expect(screen.getByRole("menu")).toBeTruthy();
      expect(
        within(menu)
          .getByRole("menuitemradio", { name: "core.global.theme.dark" })
          .getAttribute("aria-checked"),
      ).toBe("true");
    });
  });
});
