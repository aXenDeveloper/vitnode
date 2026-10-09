// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupTextarea,
} from "./input-group";

describe("InputGroupAddon", () => {
  it("focuses the input when the addon is clicked", () => {
    render(
      <InputGroup>
        <InputGroupInput aria-label="Search" />
        <InputGroupAddon>Find</InputGroupAddon>
      </InputGroup>,
    );

    fireEvent.click(screen.getByText("Find"));

    expect(document.activeElement).toBe(
      screen.getByRole("textbox", { name: "Search" }),
    );
  });

  it("focuses the textarea when the addon is clicked", () => {
    render(
      <InputGroup>
        <InputGroupTextarea aria-label="Message" />
        <InputGroupAddon align="block-end">Markdown supported</InputGroupAddon>
      </InputGroup>,
    );

    fireEvent.click(screen.getByText("Markdown supported"));

    expect(document.activeElement).toBe(
      screen.getByRole("textbox", { name: "Message" }),
    );
  });

  it("leaves focus alone when a button inside the addon is clicked", () => {
    render(
      <InputGroup>
        <InputGroupInput aria-label="Search" />
        <InputGroupAddon align="inline-end">
          <InputGroupButton>Clear</InputGroupButton>
        </InputGroupAddon>
      </InputGroup>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(document.activeElement).not.toBe(
      screen.getByRole("textbox", { name: "Search" }),
    );
  });
});
