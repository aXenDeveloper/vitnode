import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ErrorContent } from "./error-content";

const numeralsOf = (container: HTMLElement) => {
  const numerals = container.querySelector("[data-slot=error-numerals]");
  if (!(numerals instanceof HTMLElement)) throw new Error("No numerals row");

  return numerals;
};

describe("ErrorContent", () => {
  it("announces the code with the title and hides the decorative digits", () => {
    const { container } = render(
      <ErrorContent
        code={404}
        description="The page you're looking for doesn't exist."
        title="Page Not Found"
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "404 Page Not Found" }),
    ).toBeDefined();
    expect(numeralsOf(container).getAttribute("aria-hidden")).toBe("true");
  });
});
