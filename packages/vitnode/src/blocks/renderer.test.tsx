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

const registry = createBlockRegistry([
  { pluginId: "@vitnode/core", blocks: [heroBlock], namespace: "core" },
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
});

describe("a block array that predates areas", () => {
  it("renders exactly what it always did, with nothing wrapped around it", () => {
    const { container } = render(
      <ContentRenderer
        blocks={[instance("First", "01"), instance("Second", "02")]}
        registry={registry}
      />,
    );

    expect(container.innerHTML).toBe(
      '<h1 data-block="01" data-index="0">First</h1><h1 data-block="02" data-index="1">Second</h1>',
    );
    expect(container.querySelector("[data-area-id]")).toBeNull();
  });

  it("leaves a block with no variants of its own untouched", () => {
    render(
      <ContentRenderer
        blocks={[{ ...instance("Plain", "01"), variant: undefined }]}
        registry={registry}
      />,
    );

    expect(screen.getByRole("heading").textContent).toBe("Plain");
  });
});

describe("which presentation a block renders", () => {
  const Card = ({ data, variant }: BlockComponentProps) => (
    <article data-variant={variant ?? "none"}>{String(data.title)}</article>
  );

  const variantRegistry = createBlockRegistry([
    {
      pluginId: "@vitnode/core",
      namespace: "core",
      blocks: [
        {
          component: Card,
          defaultVariant: "compact",
          fields: heroFields,
          id: "card",
          variants: [{ id: "compact" }, { id: "wide" }],
        },
      ],
    },
  ]);

  const card = (variant?: string) => ({
    data: { title: "Card" },
    id: "01",
    type: "core:card",
    ...(variant === undefined ? {} : { variant }),
  });

  it("hands the component the variant that is stored", () => {
    render(
      <ContentRenderer blocks={[card("wide")]} registry={variantRegistry} />,
    );

    expect(screen.getByRole("article").dataset.variant).toBe("wide");
  });

  it("falls back to the variant the block calls its default", () => {
    render(<ContentRenderer blocks={[card()]} registry={variantRegistry} />);

    expect(screen.getByRole("article").dataset.variant).toBe("compact");
  });

  it("hands no variant at all to a block that defines none", () => {
    const plain = createBlockRegistry([
      {
        pluginId: "@vitnode/core",
        namespace: "core",
        blocks: [{ component: Card, fields: heroFields, id: "card" }],
      },
    ]);

    render(<ContentRenderer blocks={[card()]} registry={plain} />);

    expect(screen.getByRole("article").dataset.variant).toBe("none");
  });

  it("refuses a variant the block does not define, rather than guessing one", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    render(
      <ContentRenderer blocks={[card("hero")]} registry={variantRegistry} />,
    );

    expect(screen.queryByRole("article")).toBeNull();
    expect(screen.getByRole("note").textContent).toContain("variant");
  });

  it("says which block and which variant in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    render(
      <ContentRenderer blocks={[card("hero")]} registry={variantRegistry} />,
    );

    expect(String(warn.mock.calls[0][0])).toContain("core:card");
    expect(String(warn.mock.calls[0][0])).toContain("hero");
  });

  it("hands the fallback the reason, so an application can render its own", () => {
    render(
      <ContentRenderer
        blocks={[card("hero")]}
        fallback={({ reason }) => <p>{reason}</p>}
        registry={variantRegistry}
      />,
    );

    expect(screen.getByText("unknown-variant")).toBeTruthy();
  });

  it("refuses it even where the caller trusts the stored data", () => {
    vi.stubEnv("NODE_ENV", "production");

    render(
      <ContentRenderer
        blocks={[card("hero"), instance("Beside", "02")]}
        registry={createBlockRegistry([
          {
            pluginId: "@vitnode/core",
            namespace: "core",
            blocks: [
              {
                component: Card,
                defaultVariant: "compact",
                fields: heroFields,
                id: "card",
                variants: [{ id: "compact" }],
              },
              heroBlock,
            ],
          },
        ])}
        validate="never"
      />,
    );

    expect(screen.queryByRole("article")).toBeNull();
    expect(screen.getByRole("heading").textContent).toBe("Beside");
  });
});
