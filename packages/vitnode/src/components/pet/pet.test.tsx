import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { getPetSvgMarkup } from "./export";
import { Pet, PET_STATE_NAMES } from "./pet";

const petOf = (container: HTMLElement) => {
  const svg = container.querySelector("svg.vitnode-pet");
  if (!(svg instanceof SVGSVGElement)) throw new Error("Pet SVG not rendered");

  return svg;
};

describe("Pet", () => {
  it("hides a decorative pet from assistive technology", () => {
    const { container } = render(<Pet state="hello" />);

    expect(petOf(container).getAttribute("aria-hidden")).toBe("true");
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("names the pet when it carries meaning", () => {
    render(<Pet label="Tabby waves hello" state="hello" />);

    expect(
      screen.getByRole("img", { name: "Tabby waves hello" }),
    ).toBeDefined();
  });

  it.each(PET_STATE_NAMES)("draws the %s state", state => {
    const { container } = render(<Pet state={state} />);

    expect(petOf(container).dataset.petState).toBe(state);
    expect(petOf(container).childElementCount).toBeGreaterThan(0);
  });
});

describe("getPetSvgMarkup", () => {
  it("exports a standalone animated SVG with room for tails and props", () => {
    const { container } = render(<Pet state="celebrate" />);
    const markup = getPetSvgMarkup(petOf(container));

    expect(markup).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(markup).toContain('viewBox="-48 -24 496 488"');
    expect(markup).toContain("@keyframes vn-pet-confetti");
    expect(markup).not.toContain("aria-hidden");
  });

  it("leaves the animation styles out of a static export", () => {
    const { container } = render(<Pet state="dizzy" />);

    expect(
      getPetSvgMarkup(petOf(container), { animated: false }),
    ).not.toContain("@keyframes");
  });
});
