import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SettingsShellContent } from "./shell-content";

vi.mock("use-intl", () => ({
  useTranslations: (namespace?: string) => (key: string) =>
    namespace ? `${namespace}.${key}` : key,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    ...props
  }: React.ComponentProps<"a"> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

const TITLE = "core.auth.settings.title";

const shell = (pathname: string) => (
  <SettingsShellContent
    nav={<button type="button">Devices</button>}
    pathname={pathname}
  >
    <p>panel</p>
  </SettingsShellContent>
);

describe("SettingsShellContent", () => {
  it("links back to the settings root only from a sub-panel", () => {
    const { rerender } = render(shell("/settings"));

    expect(screen.queryByRole("link", { name: TITLE })).toBeNull();

    rerender(shell("/settings/devices"));

    expect(screen.getByRole("link", { name: TITLE }).getAttribute("href")).toBe(
      "/settings",
    );
  });

  it("leaves focus alone on the first render", () => {
    render(shell("/settings/devices"));

    expect(document.activeElement).toBe(document.body);
  });

  it("catches focus when navigating hides the item that had it", () => {
    const { rerender } = render(shell("/settings"));
    screen.getByRole("button", { name: "Devices" }).focus();

    rerender(shell("/settings/devices"));

    expect(document.activeElement?.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement?.contains(screen.getByText("panel"))).toBe(
      true,
    );
  });
});
