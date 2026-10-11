import { render, waitFor } from "@testing-library/react";
import React from "react";
import { expect, test } from "vitest";

import { DynamicIcon } from "./dynamic-icon";
import { readLucideIcon, seedLucideIcons } from "./icon-registry";

test("shows the placeholder, then swaps in the icon once it loads", async () => {
  const { container } = render(
    <DynamicIcon className="size-5" name="camera" />,
  );

  expect(container.querySelector("svg")).toBeNull();
  expect(container.querySelector("span.size-5")).not.toBeNull();

  await waitFor(() => {
    expect(container.querySelector("svg.lucide-camera")).not.toBeNull();
  });

  expect(container.querySelector("span.size-5")).toBeNull();
});

test("renders a seeded icon synchronously on the first paint", () => {
  const house = readLucideIcon("camera");

  if (!house) throw new Error("camera should be cached by the previous test");

  seedLucideIcons({ "seeded-icon": { ...house, name: "seeded-icon" } });

  const { container } = render(<DynamicIcon name="seeded-icon" />);

  expect(container.querySelector("svg.lucide-seeded-icon")).not.toBeNull();
});

test("removes the placeholder once an unknown icon resolves to nothing", async () => {
  const { container } = render(
    <DynamicIcon fallback={<span id="fallback" />} name="not-a-real-icon" />,
  );

  expect(container.querySelector("#fallback")).not.toBeNull();

  await waitFor(() => {
    expect(container.querySelector("#fallback")).toBeNull();
  });

  expect(container.innerHTML).toBe("");
});
