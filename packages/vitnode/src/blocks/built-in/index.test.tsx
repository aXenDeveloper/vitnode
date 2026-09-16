import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { blocks } from ".";
import { createBlockInstance } from "../instance";
import { createBlockRegistry } from "../registry";
import { ContentRenderer } from "../renderer";

const registry = createBlockRegistry([blocks]);

const renderBlock = (type: string, data: Record<string, unknown>) =>
  render(
    <ContentRenderer
      blocks={[createBlockInstance(type, data)]}
      registry={registry}
      validate="always"
    />,
  );

const classesOf = (container: HTMLElement) =>
  [...container.querySelectorAll("[class]")].flatMap(node => [
    ...node.classList,
  ]);

describe("core's blocks", () => {
  it("registers under the core namespace", () => {
    expect(registry.all().map(entry => entry.type)).toStrictEqual([
      "core:cta",
      "core:hero",
      "core:text",
    ]);
  });

  it("renders a hero", () => {
    const { getByRole } = renderBlock("core:hero", {
      description: "Everything you need.",
      eyebrow: "New",
      title: "Build your community",
    });

    expect(getByRole("heading", { level: 1 }).textContent).toBe(
      "Build your community",
    );
  });

  it("centres a hero only when it is asked to", () => {
    const { container: start } = renderBlock("core:hero", { title: "A" });
    const { container: centered } = renderBlock("core:hero", {
      align: "center",
      title: "A",
    });

    expect(classesOf(start)).not.toContain("text-center");
    expect(classesOf(centered)).toContain("text-center");
  });

  it("splits text on blank lines", () => {
    const { container } = renderBlock("core:text", {
      body: "First.\n\nSecond.",
      heading: "About",
    });

    expect(
      [...container.querySelectorAll("p")].map(node => node.textContent),
    ).toStrictEqual(["First.", "Second."]);
  });

  it("constrains text width unless the block asks for the full one", () => {
    const { container: prose } = renderBlock("core:text", { body: "A" });
    const { container: full } = renderBlock("core:text", {
      body: "A",
      width: "full",
    });

    expect(classesOf(prose)).toContain("max-w-prose");
    expect(classesOf(full)).not.toContain("max-w-prose");
  });

  it("renders a call to action with its link", () => {
    const { getByRole } = renderBlock("core:cta", {
      href: "/docs",
      label: "Read the docs",
      title: "Get started",
    });

    expect(getByRole("link").getAttribute("href")).toBe("/docs");
  });

  it("never emits a class name two classes ran together", () => {
    for (const [type, data] of [
      ["core:hero", { align: "center", title: "A" }],
      ["core:hero", { title: "A" }],
      ["core:text", { body: "A" }],
      ["core:text", { body: "A", width: "full" }],
      ["core:cta", { href: "/x", label: "Go", title: "T" }],
    ] as const) {
      const { container } = renderBlock(type, data);

      for (const className of classesOf(container)) {
        expect(className).toMatch(/^[a-z0-9:/[\].,_-]+$/i);
        expect(className.length).toBeLessThan(40);
      }
    }
  });
});
