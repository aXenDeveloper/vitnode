// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
} from "./sidebar";

const ITEM_TOPS: Record<string, number> = {
  Dashboard: 0,
  Roles: 72,
  Users: 36,
};

const Nav = ({ activeItem }: { activeItem: string }) => (
  <SidebarProvider>
    <SidebarContent>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton isActive={activeItem === "Dashboard"}>
            Dashboard
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            isActive={activeItem === "Users" || activeItem === "Roles"}
          >
            Users
          </SidebarMenuButton>
          <SidebarMenuSub>
            <SidebarMenuSubItem>
              <SidebarMenuSubButton
                href="/roles"
                isActive={activeItem === "Roles"}
              >
                Roles
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          </SidebarMenuSub>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarContent>
  </SidebarProvider>
);

const sidebarPart = (name: string) => {
  const element = document.querySelector(`[data-sidebar="${name}"]`);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing sidebar ${name}`);
  }

  return element;
};

const indicator = (name: "active" | "hover") =>
  sidebarPart(`${name}-indicator`);

const rectOf = (top: number) => new DOMRect(0, top, 200, 32);

describe("SidebarContent gliding indicators", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        addEventListener: vi.fn(),
        matches: false,
        removeEventListener: vi.fn(),
      })),
    );
    vi.stubGlobal(
      "ResizeObserver",
      class {
        disconnect() {}
        observe() {}
        unobserve() {}
      },
    );
    vi.spyOn(Element.prototype, "getClientRects").mockImplementation(
      () => [rectOf(0)] as unknown as DOMRectList,
    );
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        if (this.matches('[data-sidebar="content"]')) {
          return new DOMRect(0, 0, 200, 400);
        }

        return rectOf(ITEM_TOPS[this.textContent] ?? 0);
      },
    );
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(200);
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(32);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("places the active indicator under the active item", () => {
    render(<Nav activeItem="Dashboard" />);

    expect(indicator("active").style.opacity).toBe("1");
    expect(indicator("active").style.translate).toBe("0px 0px");
    expect(indicator("active").style.width).toBe("200px");
  });

  it("glides the active indicator to the newly active item", async () => {
    const { rerender } = render(<Nav activeItem="Dashboard" />);

    rerender(<Nav activeItem="Users" />);

    await vi.waitFor(() => {
      expect(indicator("active").style.translate).toBe("0px 36px");
    });
    expect(indicator("active").style.transitionProperty).toBe("");
  });

  it("prefers the active sub-item over its active parent", () => {
    render(<Nav activeItem="Roles" />);

    expect(indicator("active").style.translate).toBe("0px 72px");
  });

  it("follows the mouse with the hover indicator and hides it on leave", () => {
    render(<Nav activeItem="Dashboard" />);

    fireEvent.pointerOver(screen.getByText("Users"), { pointerType: "mouse" });

    expect(indicator("hover").style.opacity).toBe("1");
    expect(indicator("hover").style.translate).toBe("0px 36px");

    fireEvent.pointerLeave(sidebarPart("content"));

    expect(indicator("hover").style.opacity).toBe("0");
  });

  it("keeps the hover indicator hidden over the active item", () => {
    render(<Nav activeItem="Dashboard" />);

    fireEvent.pointerOver(screen.getByText("Dashboard"), {
      pointerType: "mouse",
    });

    expect(indicator("hover").style.opacity).toBe("0");
  });

  it("ignores touch pointers", () => {
    render(<Nav activeItem="Dashboard" />);

    fireEvent.pointerOver(screen.getByText("Users"), { pointerType: "touch" });

    expect(indicator("hover").style.opacity).not.toBe("1");
  });

  it("shrinks the indicator under a pressed item and restores it on release", () => {
    render(<Nav activeItem="Dashboard" />);
    const users = screen.getByText("Users");

    fireEvent.pointerOver(users, { pointerType: "mouse" });
    fireEvent.pointerDown(users, { button: 0 });

    expect(indicator("hover").hasAttribute("data-pressed")).toBe(true);
    expect(indicator("active").hasAttribute("data-pressed")).toBe(false);

    fireEvent.pointerUp(users);

    expect(indicator("hover").hasAttribute("data-pressed")).toBe(false);
  });

  it("presses the active indicator when the active item is pressed", () => {
    render(<Nav activeItem="Dashboard" />);
    const dashboard = screen.getByText("Dashboard");

    fireEvent.pointerOver(dashboard, { pointerType: "mouse" });
    fireEvent.pointerDown(dashboard, { button: 0 });

    expect(indicator("active").hasAttribute("data-pressed")).toBe(true);
    expect(indicator("hover").hasAttribute("data-pressed")).toBe(false);
  });

  it("keeps following the mouse while a view transition covers the page", () => {
    render(<Nav activeItem="Dashboard" />);

    fireEvent.pointerMove(document.documentElement, {
      clientX: 20,
      clientY: 40,
      pointerType: "mouse",
    });

    expect(indicator("hover").style.opacity).toBe("1");
    expect(indicator("hover").style.translate).toBe("0px 36px");

    fireEvent.pointerMove(document.documentElement, {
      clientX: 20,
      clientY: 500,
      pointerType: "mouse",
    });

    expect(indicator("hover").style.opacity).toBe("0");
  });

  it("marks the hover indicator hidden once the pointer leaves", () => {
    render(<Nav activeItem="Dashboard" />);

    fireEvent.pointerOver(screen.getByText("Users"), { pointerType: "mouse" });

    expect(indicator("hover").hasAttribute("data-hidden")).toBe(false);

    fireEvent.pointerLeave(sidebarPart("content"));

    expect(indicator("hover").hasAttribute("data-hidden")).toBe(true);
  });
});

describe("Sidebar view transitions", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        addEventListener: vi.fn(),
        matches: false,
        removeEventListener: vi.fn(),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("gives every sidebar its own view transition name", () => {
    render(
      <SidebarProvider>
        <Sidebar>Navigation</Sidebar>
        <Sidebar side="right">Widgets</Sidebar>
      </SidebarProvider>,
    );

    const names = [
      ...document.querySelectorAll<HTMLElement>(
        '[data-slot="sidebar-container"]',
      ),
    ].map(container => container.style.viewTransitionName);

    expect(names).toHaveLength(2);
    expect(new Set(names).size).toBe(2);
    expect(names.every(name => /^vitnode-sidebar-[\w-]+$/.test(name))).toBe(
      true,
    );
  });
});
