import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Spinner } from "./spinner";

describe("Spinner", () => {
  it("is labelled 'Loading' in the user's language by default", () => {
    render(<Spinner />);

    expect(
      screen.getByRole("status", { name: "core.global.loading" }),
    ).toBeTruthy();
  });

  it("keeps a custom label", () => {
    render(<Spinner aria-label="Searching" />);

    expect(screen.getByRole("status", { name: "Searching" })).toBeTruthy();
  });

  it("can be hidden from assistive tech next to text that says it all", () => {
    render(<Spinner aria-hidden="true" />);

    expect(screen.queryByRole("status")).toBeNull();
  });
});
