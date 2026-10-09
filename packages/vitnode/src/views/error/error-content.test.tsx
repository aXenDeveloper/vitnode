import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ErrorContent } from "./error-content";

const numeralsOf = (container: HTMLElement) => {
  const numerals = container.querySelector("[data-slot=error-numerals]");
  if (!(numerals instanceof HTMLElement)) throw new Error("No numerals row");

  return numerals;
};

describe("ErrorContent", () => {
  it.each([
    [404, "oops", ["4", "4"]],
    [500, "dizzy", ["5", "0"]],
  ] as const)(
    "puts the %s pet in place of the middle digit",
    (code, state, digits) => {
      const { container } = render(
        <ErrorContent code={code} title="Something broke" />,
      );
      const numerals = numeralsOf(container);

      expect(
        numerals
          .querySelector("svg.vitnode-pet")
          ?.getAttribute("data-pet-state"),
      ).toBe(state);
      expect(
        [...numerals.querySelectorAll("span")].map(span => span.textContent),
      ).toEqual(digits);
    },
  );

  it("keeps every digit when the code has no pet", () => {
    const { container } = render(<ErrorContent code={403} title="Forbidden" />);
    const numerals = numeralsOf(container);

    expect(numerals.querySelector("svg.vitnode-pet")).toBeNull();
    expect(numerals.textContent).toBe("403");
  });

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
