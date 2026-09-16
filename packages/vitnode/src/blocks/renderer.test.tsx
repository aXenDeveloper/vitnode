import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { BlockComponentProps, BlockData } from "./types";

import { field } from "../content/fields";
import { defineBlock } from "./define";
import { createBlockInstance } from "./instance";
import { createBlockRegistry, setDefaultBlockRegistry } from "./registry";
import { ContentRenderer } from "./renderer";

const heroFields = {
  title: field.text({ maxLength: 20, required: true }),
};

const Hero = ({
  blockId,
  data,
  index,
}: BlockComponentProps<BlockData<typeof heroFields>>) => (
  <h1 data-block={blockId} data-index={index}>
    {data.title}
  </h1>
);

const heroBlock = defineBlock({
  component: Hero,
  fields: heroFields,
  id: "hero",
});

const noteBlock = defineBlock({
  component: ({ data }: BlockComponentProps<{ body: string }>) => (
    <p>{data.body}</p>
  ),
  fields: { body: field.text({ required: true }) },
  id: "note",
});

const registry = createBlockRegistry([
  { pluginId: "@vitnode/core", blocks: [heroBlock], namespace: "core" },
  { pluginId: "@vitnode/example", blocks: [noteBlock], namespace: "example" },
]);

const instance = (title: string, id: string) => ({
  data: { title },
  id,
  type: "core:hero",
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("ContentRenderer", () => {
  it("renders every registered block in stored order", () => {
    render(
      <ContentRenderer
        blocks={[instance("First", "01"), instance("Second", "02")]}
        registry={registry}
      />,
    );

    expect(
      screen.getAllByRole("heading").map(node => node.textContent),
    ).toStrictEqual(["First", "Second"]);
  });

  it("hands the component the instance id and its position", () => {
    render(
      <ContentRenderer
        blocks={[instance("First", "01")]}
        registry={registry}
      />,
    );

    const heading = screen.getByRole("heading");
    expect(heading.dataset.block).toBe("01");
    expect(heading.dataset.index).toBe("0");
  });

  it("passes data the block's own schema validated", () => {
    render(
      <ContentRenderer
        blocks={[{ data: { title: "Parsed" }, id: "01", type: "core:hero" }]}
        registry={registry}
      />,
    );

    expect(screen.getByRole("heading").textContent).toBe("Parsed");
  });

  it("renders nothing for an empty or absent zone", () => {
    const { container } = render(
      <ContentRenderer blocks={[]} registry={registry} />,
    );

    expect(container.innerHTML).toBe("");
    render(<ContentRenderer blocks={null} registry={registry} />);
  });

  describe("where the registry comes from", () => {
    it("uses the one it was handed", () => {
      render(
        <ContentRenderer
          blocks={[instance("Explicit", "01")]}
          registry={registry}
        />,
      );

      expect(screen.getByRole("heading").textContent).toBe("Explicit");
    });

    it("falls back to the process default when none is passed", () => {
      const restore = setDefaultBlockRegistry(registry);
      try {
        render(<ContentRenderer blocks={[instance("Default", "01")]} />);

        expect(screen.getByRole("heading").textContent).toBe("Default");
      } finally {
        restore();
      }
    });

    it("says what to do when there is neither", () => {
      expect(() =>
        render(<ContentRenderer blocks={[instance("Nowhere", "01")]} />),
      ).toThrow(/setDefaultBlockRegistry/);
    });

    it("renders two applications' registries side by side in one process", () => {
      const other = createBlockRegistry([
        {
          pluginId: "@acme/site",
          namespace: "site",
          blocks: [
            defineBlock({ component: Hero, fields: heroFields, id: "hero" }),
          ],
        },
      ]);

      render(
        <>
          <ContentRenderer
            blocks={[instance("Core", "01")]}
            registry={registry}
          />
          <ContentRenderer
            blocks={[{ data: { title: "Acme" }, id: "02", type: "site:hero" }]}
            registry={other}
          />
        </>,
      );

      expect(
        screen.getAllByRole("heading").map(node => node.textContent),
      ).toStrictEqual(["Core", "Acme"]);
    });
  });

  describe("when a block is unavailable", () => {
    const withDisabledPlugin = [
      instance("Still here", "01"),
      { data: { limit: 6 }, id: "02", type: "blog:latest-posts" },
    ];

    it("keeps rendering the rest of the page", () => {
      vi.stubEnv("NODE_ENV", "production");
      render(
        <ContentRenderer blocks={withDisabledPlugin} registry={registry} />,
      );

      expect(screen.getByRole("heading").textContent).toBe("Still here");
    });

    it("shows nothing to a visitor in production", () => {
      vi.stubEnv("NODE_ENV", "production");
      render(
        <ContentRenderer blocks={withDisabledPlugin} registry={registry} />,
      );

      expect(screen.queryByRole("note")).toBeNull();
    });

    it("says so in development", () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
      render(
        <ContentRenderer blocks={withDisabledPlugin} registry={registry} />,
      );

      expect(screen.getByRole("note").textContent).toContain(
        "blog:latest-posts",
      );
    });

    it("accepts a fallback of the application's own", () => {
      render(
        <ContentRenderer
          blocks={withDisabledPlugin}
          fallback={({ instance: missing }) => <p>missing {missing.type}</p>}
          registry={registry}
        />,
      );

      expect(screen.getByText("missing blog:latest-posts")).toBeTruthy();
    });
  });

  describe("validation of persisted data", () => {
    const drifted = [
      { data: { headline: "renamed field" }, id: "01", type: "core:hero" },
      instance("Fine", "02"),
    ];

    it("trusts what is stored in production, where the write boundary validated it", () => {
      vi.stubEnv("NODE_ENV", "production");
      render(<ContentRenderer blocks={drifted} registry={registry} />);

      expect(screen.getAllByRole("heading")).toHaveLength(2);
    });

    it("checks the shape of the data, never the value constraints on it", () => {
      vi.stubEnv("NODE_ENV", "development");
      render(
        <ContentRenderer
          blocks={[
            {
              data: { title: "a title far longer than the field allows" },
              id: "01",
              type: "core:hero",
            },
          ]}
          registry={registry}
        />,
      );

      expect(screen.getByRole("heading").textContent).toBe(
        "a title far longer than the field allows",
      );
    });

    it("skips a block whose required field is gone", () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
      render(
        <ContentRenderer
          blocks={[{ data: {}, id: "01", type: "core:hero" }]}
          registry={registry}
        />,
      );

      expect(screen.queryByRole("heading")).toBeNull();
    });

    it("skips a block whose value is the wrong kind entirely", () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
      render(
        <ContentRenderer
          blocks={[{ data: { title: 7 }, id: "01", type: "core:hero" }]}
          registry={registry}
        />,
      );

      expect(screen.queryByRole("heading")).toBeNull();
    });

    it("skips data that no longer matches the block in development", () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
      render(<ContentRenderer blocks={drifted} registry={registry} />);

      expect(
        screen.getAllByRole("heading").map(node => node.textContent),
      ).toStrictEqual(["Fine"]);
    });

    it("skips it in production too when the caller asks to validate", () => {
      vi.stubEnv("NODE_ENV", "production");
      render(
        <ContentRenderer
          blocks={drifted}
          registry={registry}
          validate="always"
        />,
      );

      expect(
        screen.getAllByRole("heading").map(node => node.textContent),
      ).toStrictEqual(["Fine"]);
    });

    it("renders it in development when the caller opts out", () => {
      vi.stubEnv("NODE_ENV", "development");
      render(
        <ContentRenderer
          blocks={drifted}
          registry={registry}
          validate="never"
        />,
      );

      expect(screen.getAllByRole("heading")).toHaveLength(2);
    });

    it("never reads a block's fields at all on a trusted render", () => {
      vi.stubEnv("NODE_ENV", "production");
      const reads = vi.fn();
      const counted = createBlockRegistry([
        {
          pluginId: "@vitnode/core",
          namespace: "core",
          blocks: [
            {
              ...heroBlock,
              get fields() {
                reads();

                return heroFields;
              },
            },
          ],
        },
      ]);

      render(
        <ContentRenderer
          blocks={[instance("One", "01"), instance("Two", "02")]}
          registry={counted}
        />,
      );

      expect(screen.getAllByRole("heading")).toHaveLength(2);
      expect(reads).not.toHaveBeenCalled();
    });

    it("passes the stored data through untouched, so a render never differs from what was written", () => {
      vi.stubEnv("NODE_ENV", "development");
      render(
        <ContentRenderer
          blocks={[{ data: { title: "Exact" }, id: "01", type: "core:hero" }]}
          registry={registry}
        />,
      );

      expect(screen.getByRole("heading").textContent).toBe("Exact");
    });
  });

  it("skips a value that is not a block instance at all", () => {
    vi.stubEnv("NODE_ENV", "production");
    const { container } = render(
      <ContentRenderer blocks={["nonsense", null]} registry={registry} />,
    );

    expect(container.innerHTML).toBe("");
  });

  it("keys instances by their stable id", () => {
    const one = createBlockInstance("core:hero", { title: "One" });
    const { rerender } = render(
      <ContentRenderer blocks={[one]} registry={registry} />,
    );
    const first = screen.getByRole("heading");

    rerender(
      <ContentRenderer
        blocks={[createBlockInstance("core:hero", { title: "Zero" }), one]}
        registry={registry}
      />,
    );

    expect(screen.getAllByRole("heading")[1]).toBe(first);
  });

  describe("an allowlist the caller passes in", () => {
    const mixed = [
      { data: { title: "Allowed" }, id: "01", type: "core:hero" },
      { data: { body: "Refused" }, id: "02", type: "example:note" },
    ];

    it("skips what it refuses and renders the rest", () => {
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
      render(
        <ContentRenderer
          allowed={["core:*"]}
          blocks={mixed}
          registry={registry}
        />,
      );

      expect(screen.getByRole("heading").textContent).toBe("Allowed");
      expect(screen.queryByText("Refused")).toBeNull();
    });

    it("is not checked in production, where the write boundary already was", () => {
      vi.stubEnv("NODE_ENV", "production");
      render(
        <ContentRenderer
          allowed={["core:*"]}
          blocks={mixed}
          registry={registry}
        />,
      );

      expect(screen.getByText("Refused")).toBeDefined();
    });

    it("costs nothing when the caller has no allowlist", () => {
      render(<ContentRenderer blocks={mixed} registry={registry} />);

      expect(screen.getByText("Refused")).toBeDefined();
    });

    it("refuses a block before asking the registry about it", () => {
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
      render(
        <ContentRenderer
          allowed={["core:*"]}
          blocks={[{ data: {}, id: "01", type: "shop:cart" }]}
          registry={registry}
        />,
      );

      expect(screen.getByRole("note").textContent).toContain(
        "is not allowed in this zone",
      );
    });
  });
});
