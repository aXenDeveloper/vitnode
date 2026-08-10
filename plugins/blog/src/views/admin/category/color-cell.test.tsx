import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BlogCategoryColorCell } from "./color-cell";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

type Row = Parameters<typeof BlogCategoryColorCell>[0]["row"];

const renderCell = (color: null | string) =>
  render(<BlogCategoryColorCell row={{ color } as unknown as Row} />);

describe("BlogCategoryColorCell", () => {
  it("says the colour in words as well as showing it", () => {
    const { container } = renderCell("#3260c0");

    // The value is real text, so a screen reader and a colour-blind reader get
    // the same information the swatch carries.
    expect(screen.getByText("#3260c0")).toBeTruthy();

    const swatch = container.querySelector("span[aria-hidden]");
    expect(swatch).toBeTruthy();
    expect((swatch as HTMLElement).style.backgroundColor).toBe(
      "rgb(50, 96, 192)",
    );
  });

  it("keeps the swatch out of the accessibility tree", () => {
    const { container } = renderCell("#3260c0");

    expect(container.querySelector("span[aria-hidden]")?.textContent).toBe("");
  });

  it("names the empty state rather than rendering a blank cell", () => {
    renderCell(null);

    expect(screen.getByText("color.none")).toBeTruthy();
    expect(screen.queryByText("#3260c0")).toBeNull();
  });
});
