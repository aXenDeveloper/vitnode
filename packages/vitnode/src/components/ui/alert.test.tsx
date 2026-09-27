import { render, screen } from "@testing-library/react";
import { HardDriveIcon } from "lucide-react";
import { describe, expect, it } from "vitest";

import { Alert, AlertDescription, AlertTitle } from "./alert";

const iconOf = (alert: HTMLElement) =>
  alert.querySelector("[data-slot=alert-icon] svg");

describe("Alert", () => {
  it.each([
    ["default", "lucide-info"],
    ["info", "lucide-info"],
    ["success", "lucide-circle-check"],
    ["warning", "lucide-triangle-alert"],
    ["destructive", "lucide-circle-x"],
  ] as const)("shows the %s icon without being given one", (variant, icon) => {
    render(
      <Alert variant={variant}>
        <AlertTitle>Plugins need a workspace</AlertTitle>
      </Alert>,
    );

    expect(iconOf(screen.getByRole("alert"))?.classList).toContain(icon);
  });

  it("renders a custom icon in place of the default one", () => {
    render(
      <Alert icon={<HardDriveIcon />} variant="info">
        <AlertTitle>Storage</AlertTitle>
      </Alert>,
    );

    expect(iconOf(screen.getByRole("alert"))?.classList).toContain(
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
