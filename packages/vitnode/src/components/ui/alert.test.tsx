import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Alert, AlertDescription, AlertTitle } from "./alert";

describe("Alert", () => {
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
