// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { HardDriveIcon } from "lucide-react";
import { describe, expect, it } from "vitest";

import { Alert, AlertDescription, AlertTitle } from "./alert";

const iconOf = (alert: HTMLElement) =>
  alert.querySelector("[data-slot=alert-icon] svg");

describe("Alert", () => {
  it.each([
    ["info", "status", "lucide-info"],
    ["success", "status", "lucide-circle-check"],
    ["warning", "alert", "lucide-triangle-alert"],
    ["destructive", "alert", "lucide-circle-x"],
  ] as const)(
    "shows the %s icon without being given one",
    (variant, role, icon) => {
      render(
        <Alert variant={variant}>
          <AlertTitle>Plugins need a workspace</AlertTitle>
        </Alert>,
      );

      expect(iconOf(screen.getByRole(role))?.classList).toContain(icon);
    },
  );

  it("renders the neutral default notice without an icon", () => {
    render(
      <Alert>
        <AlertTitle>Sign-in is paused</AlertTitle>
      </Alert>,
    );

    expect(
      screen.getByRole("status").querySelector("[data-slot=alert-icon]"),
    ).toBeNull();
  });

  it.each([
    ["default", "status"],
    ["info", "status"],
    ["success", "status"],
    ["warning", "alert"],
    ["destructive", "alert"],
  ] as const)(
    "announces the %s variant politely only when it is not urgent",
    (variant, role) => {
      render(
        <Alert variant={variant}>
          <AlertTitle>Heads up</AlertTitle>
        </Alert>,
      );

      expect(screen.getByRole(role).textContent).toBe("Heads up");
    },
  );

  it("lets the caller override the role", () => {
    render(
      <Alert role="note" variant="destructive">
        <AlertTitle>Static note</AlertTitle>
      </Alert>,
    );

    expect(screen.getByRole("note").textContent).toBe("Static note");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("renders a custom icon in place of the default one", () => {
    render(
      <Alert icon={<HardDriveIcon />} variant="info">
        <AlertTitle>Storage</AlertTitle>
      </Alert>,
    );

    expect(iconOf(screen.getByRole("status"))?.classList).toContain(
      "lucide-hard-drive",
    );
  });

  it("drops the icon when it is set to null", () => {
    render(
      <Alert icon={null} variant="warning">
        <AlertTitle>No icon</AlertTitle>
      </Alert>,
    );

    expect(
      screen.getByRole("alert").querySelector("[data-slot=alert-icon]"),
    ).toBeNull();
  });

  it("keeps the title above the description", () => {
    render(
      <Alert variant="warning">
        <AlertTitle>Plugins need a workspace</AlertTitle>
        <AlertDescription>
          Run the generator from a repository.
        </AlertDescription>
      </Alert>,
    );

    const content = screen
      .getByRole("alert")
      .querySelector("[data-slot=alert-content]");
    expect(
      [...(content?.children ?? [])].map(child => child.textContent),
    ).toEqual([
      "Plugins need a workspace",
      "Run the generator from a repository.",
    ]);
  });
});
