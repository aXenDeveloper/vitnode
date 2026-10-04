import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Progress, ProgressLabel, ProgressValue } from "./progress";

describe("Progress", () => {
  it("names the bar with its label and shows the value", () => {
    render(
      <Progress value={42}>
        <ProgressLabel>Uploading</ProgressLabel>
        <ProgressValue />
      </Progress>,
    );

    const bar = screen.getByRole("progressbar", { name: "Uploading" });

    expect(bar.getAttribute("aria-valuenow")).toBe("42");
    expect(bar.querySelector("[data-slot=progress-value]")?.textContent).toBe(
      "42%",
    );
  });

  it("still renders a plain bar without a label", () => {
    render(<Progress value={70} />);

    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
      "70",
    );
  });

  it("reports an unknown amount when the value is null", () => {
    render(
      <Progress value={null}>
        <ProgressLabel>Preparing</ProgressLabel>
      </Progress>,
    );

    const bar = screen.getByRole("progressbar", { name: "Preparing" });

    expect(bar.hasAttribute("aria-valuenow")).toBe(false);
    expect(bar.hasAttribute("data-indeterminate")).toBe(true);
  });
});
