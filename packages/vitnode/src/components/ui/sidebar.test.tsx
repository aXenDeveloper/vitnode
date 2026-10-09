import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
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
});
