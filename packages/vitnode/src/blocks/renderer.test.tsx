import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  BlockComponentProps,
  BlockData,
  BlockValidationMode,
} from "./types";

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

    it("skips it in production too, where a stale object would otherwise reach a component", () => {
      vi.stubEnv("NODE_ENV", "production");
      render(<ContentRenderer blocks={drifted} registry={registry} />);

      expect(
        screen.getAllByRole("heading").map(node => node.textContent),
      ).toStrictEqual(["Fine"]);
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

    it("skips it even where the caller opts out, because the check is not a diagnostic", () => {
      vi.stubEnv("NODE_ENV", "development");
      render(
        <ContentRenderer
          blocks={drifted}
          registry={registry}
          validate="never"
        />,
      );

      expect(
        screen.getAllByRole("heading").map(node => node.textContent),
      ).toStrictEqual(["Fine"]);
    });

    it("reads a block's fields on every render, in every mode", () => {
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
      expect(reads).toHaveBeenCalled();
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

describe("structural safety on a public page", () => {
  const strictFields = {
    count: field.number({ integer: true }),
    seo: field.group({
      fields: {
        style: field.enum({ defaultValue: "light", values: ["light", "dark"] }),
        title: field.text({ nullable: true }),
      },
    }),
    title: field.text({ maxLength: 20, required: true }),
    tone: field.enum({ defaultValue: "info", values: ["info", "warning"] }),
  };

  const rendered = vi.fn();

  const Strict = ({
    data,
  }: BlockComponentProps<BlockData<typeof strictFields>>) => {
    rendered(data);

    return <h1>{data.title.toUpperCase()}</h1>;
  };

  const strictRegistry = createBlockRegistry([
    {
      pluginId: "@vitnode/core",
      namespace: "core",
      blocks: [
        defineBlock({ component: Strict, fields: strictFields, id: "strict" }),
      ],
    },
  ]);

  const stored = (data: Record<string, unknown>, id = "01") => ({
    data,
    id,
    type: "core:strict",
  });

  const inProduction = (
    data: Record<string, unknown>,
    validate?: BlockValidationMode,
  ) => {
    vi.stubEnv("NODE_ENV", "production");

    return render(
      <ContentRenderer
        blocks={[stored(data)]}
        registry={strictRegistry}
        validate={validate}
      />,
    );
  };

  beforeEach(() => {
    rendered.mockClear();
  });

  it("never calls a component for a required field that was renamed away", () => {
    const { container } = inProduction({ headline: "Hello" });

    expect(rendered).not.toHaveBeenCalled();
    expect(container.innerHTML).toBe("");
  });

  it("never calls a component for a value of the wrong kind", () => {
    inProduction({ title: 7 });

    expect(rendered).not.toHaveBeenCalled();
  });

  it("never calls a component for a null in a field that is not nullable", () => {
    inProduction({ count: null, title: "Fine" });

    expect(rendered).not.toHaveBeenCalled();
  });

  it("never calls a component for a group whose shape no longer matches", () => {
    inProduction({ seo: { headline: "gone" }, title: "Fine" });
    expect(rendered).not.toHaveBeenCalled();

    inProduction({ seo: [], title: "Fine" });
    expect(rendered).not.toHaveBeenCalled();
  });

  it("holds even where the caller turned validation off", () => {
    inProduction({ headline: "Hello" }, "never");

    expect(rendered).not.toHaveBeenCalled();
  });

  it("renders a value that only breaks a write-time rule, rather than blanking the section", () => {
    inProduction({ title: "a title far longer than the field allows" });

    expect(rendered).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("heading").textContent).toBe(
      "A TITLE FAR LONGER THAN THE FIELD ALLOWS",
    );
  });

  it("never calls a component for an enum value the block stopped declaring", () => {
    inProduction({ title: "Fine", tone: "success" });

    expect(rendered).not.toHaveBeenCalled();
  });

  it("holds that enum check where the caller turned validation off", () => {
    inProduction({ title: "Fine", tone: "success" }, "never");

    expect(rendered).not.toHaveBeenCalled();
  });

  it("never calls a component for a dropped enum value inside a group", () => {
    inProduction({ seo: { style: "legacy", title: "Hi" }, title: "Fine" });

    expect(rendered).not.toHaveBeenCalled();
  });

  it("still renders an enum value the block does declare, nested or not", () => {
    inProduction({
      seo: { style: "dark", title: "Hi" },
      title: "Fine",
      tone: "warning",
    });

    expect(rendered).toHaveBeenCalledTimes(1);
  });

  it("renders a healthy block in production with nothing in its place", () => {
    const { container } = inProduction({
      count: 3,
      seo: { title: "Hi" },
      title: "Fine",
    });

    expect(rendered).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("heading").textContent).toBe("FINE");
    expect(container.querySelector('[role="note"]')).toBeNull();
  });

  it("holds for a block stored inside an area as well", () => {
    vi.stubEnv("NODE_ENV", "production");
    render(
      <ContentRenderer
        blocks={[
          {
            children: [
              stored({ headline: "Hello" }, "01"),
              stored({ title: "Fine" }, "02"),
            ],
            id: "AREA1",
            kind: "area",
            layout: { columns: 2 },
          },
        ]}
        registry={strictRegistry}
      />,
    );

    expect(rendered).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("heading").textContent).toBe("FINE");
  });

  it("hands the fallback the reason, so an application can render its own", () => {
    vi.stubEnv("NODE_ENV", "production");
    render(
      <ContentRenderer
        blocks={[stored({ headline: "Hello" })]}
        fallback={({ reason }) => <p>{reason}</p>}
        registry={strictRegistry}
      />,
    );

    expect(screen.getByText("invalid-data")).toBeTruthy();
  });

  describe("what a developer sees", () => {
    it("still gets the notice and one warning", () => {
      vi.stubEnv("NODE_ENV", "development");
      const warned = vi
        .spyOn(console, "warn")
        .mockImplementation(() => undefined);

      render(
        <ContentRenderer
          blocks={[stored({ headline: "Hello" })]}
          registry={strictRegistry}
        />,
      );

      expect(rendered).not.toHaveBeenCalled();
      expect(screen.getByRole("note").textContent).toContain("core:strict");
      expect(warned).toHaveBeenCalledTimes(1);
    });

    it("is not warned in the mode that asks for no diagnostics", () => {
      vi.stubEnv("NODE_ENV", "development");
      const warned = vi
        .spyOn(console, "warn")
        .mockImplementation(() => undefined);

      render(
        <ContentRenderer
          blocks={[stored({ headline: "Hello" })]}
          registry={strictRegistry}
          validate="never"
        />,
      );

      expect(rendered).not.toHaveBeenCalled();
      expect(warned).not.toHaveBeenCalled();
    });
  });

  describe("who a warning is actually for", () => {
    const missing = () => ({
      data: {},
      id: "01JWARNRENDERERMISSING001",
      type: "core:not-installed",
    });

    it("says nothing to a visitor, whatever the caller asked to validate", () => {
      vi.stubEnv("NODE_ENV", "production");
      const warned = vi
        .spyOn(console, "warn")
        .mockImplementation(() => undefined);

      render(
        <ContentRenderer
          blocks={[missing()]}
          registry={registry}
          validate="always"
        />,
      );

      expect(warned).not.toHaveBeenCalled();
    });

    it("still tells a developer a block is missing, even with diagnostics off", () => {
      vi.stubEnv("NODE_ENV", "development");
      const warned = vi
        .spyOn(console, "warn")
        .mockImplementation(() => undefined);

      render(
        <ContentRenderer
          blocks={[missing()]}
          registry={registry}
          validate="never"
        />,
      );

      expect(warned).toHaveBeenCalledTimes(1);
    });
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
