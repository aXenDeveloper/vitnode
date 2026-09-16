import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { BlockComponentProps, BlockData } from "./types";

import { field } from "../content/fields";
import { defineBlock } from "./define";
import { createBlockRegistry, setDefaultBlockRegistry } from "./registry";
import { ContentZone } from "./zone";

const heroFields = {
  title: field.text({ maxLength: 40, required: true }),
};

const Hero = ({ data }: BlockComponentProps<BlockData<typeof heroFields>>) => (
  <h1>{data.title}</h1>
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

const hero = (title: string, id: string) => ({
  data: { title },
  id,
  type: "core:hero",
});

const note = (body: string, id: string) => ({
  data: { body },
  id,
  type: "example:note",
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("rendering a zone", () => {
  it("renders the blocks it is given, in stored order", () => {
    render(
      <ContentZone
        blocks={[hero("First", "01"), hero("Second", "02")]}
        id="main"
        registry={registry}
      />,
    );

    expect(
      screen.getAllByRole("heading").map(node => node.textContent),
    ).toStrictEqual(["First", "Second"]);
  });

  it("adds no element of its own by default", () => {
    const { container } = render(
      <ContentZone
        blocks={[hero("Only", "01")]}
        id="main"
        registry={registry}
      />,
    );

    expect(container.firstElementChild?.tagName).toBe("H1");
    expect(container.children).toHaveLength(1);
  });

  it("wraps in the element asked for, marked with its id", () => {
    const { container } = render(
      <ContentZone
        as="section"
        blocks={[hero("Only", "01")]}
        className="flex flex-col gap-4"
        id="homepage:hero"
        registry={registry}
      />,
    );

    const wrapper = container.querySelector("section");

    expect(wrapper).not.toBeNull();
    expect(wrapper?.getAttribute("data-vitnode-zone")).toBe("homepage:hero");
    expect(wrapper?.className).toBe("flex flex-col gap-4");
    expect(wrapper?.querySelector("h1")?.textContent).toBe("Only");
  });

  it("defaults the wrapper to a div when only a class name is given", () => {
    const { container } = render(
      <ContentZone
        blocks={[hero("Only", "01")]}
        className="mt-4"
        id="main"
        registry={registry}
      />,
    );

    expect(container.firstElementChild?.tagName).toBe("DIV");
  });

  it("writes the allowlist into the wrapper for the editor to read", () => {
    const { container } = render(
      <ContentZone
        allowedBlocks={["core:*", "example:note"]}
        as="section"
        blocks={[hero("Only", "01")]}
        id="main"
        registry={registry}
      />,
    );

    expect(
      container
        .querySelector("section")
        ?.getAttribute("data-vitnode-zone-allowed"),
    ).toBe("core:*,example:note");
  });

  it("leaves the allowlist attribute off when the zone does not restrict", () => {
    const { container } = render(
      <ContentZone
        as="section"
        blocks={[hero("Only", "01")]}
        id="main"
        registry={registry}
      />,
    );

    expect(
      container
        .querySelector("section")
        ?.hasAttribute("data-vitnode-zone-allowed"),
    ).toBe(false);
  });
});

describe("an empty zone", () => {
  it.each([
    ["an empty list", [] as const],
    ["null", null],
    ["undefined", undefined],
  ])("renders nothing for %s", (_label, blocks) => {
    const { container } = render(
      <ContentZone blocks={blocks} id="sidebar" registry={registry} />,
    );

    expect(container.innerHTML).toBe("");
  });

  it("renders no wrapper either, so it cannot leave a gap or a border", () => {
    const { container } = render(
      <ContentZone
        as="section"
        blocks={[]}
        className="border p-4"
        id="sidebar"
        registry={registry}
      />,
    );

    expect(container.innerHTML).toBe("");
  });
});

describe("several zones on one page", () => {
  it("each render their own blocks, independently", () => {
    const { container } = render(
      <>
        <ContentZone
          as="header"
          blocks={[hero("Before", "01")]}
          id="before-content"
          registry={registry}
        />

        <main>
          <h2>Locked application UI</h2>
        </main>

        <ContentZone
          as="footer"
          blocks={[note("After", "02")]}
          id="after-content"
          registry={registry}
        />
      </>,
    );

    expect(
      [...container.querySelectorAll("[data-vitnode-zone]")].map(node =>
        node.getAttribute("data-vitnode-zone"),
      ),
    ).toStrictEqual(["before-content", "after-content"]);

    expect(container.querySelector("header h1")?.textContent).toBe("Before");
    expect(container.querySelector("footer p")?.textContent).toBe("After");
    expect(container.querySelector("main h2")?.textContent).toBe(
      "Locked application UI",
    );
  });

  it("keeps a system component between them untouched", () => {
    const ProfileForm = () => <form aria-label="Profile" />;

    render(
      <>
        <ContentZone
          blocks={[hero("Before", "01")]}
          id="settings:before-profile"
          registry={registry}
        />
        <ProfileForm />
        <ContentZone
          blocks={[]}
          id="settings:after-profile"
          registry={registry}
        />
      </>,
    );

    expect(screen.getByRole("form", { name: "Profile" })).toBeDefined();
    expect(screen.getByRole("heading").textContent).toBe("Before");
  });
});

describe("the registry", () => {
  it("is the process default when none is passed", () => {
    const restore = setDefaultBlockRegistry(registry);

    try {
      render(<ContentZone blocks={[hero("Default", "01")]} id="main" />);

      expect(screen.getByRole("heading").textContent).toBe("Default");
    } finally {
      restore();
    }
  });

  it("throws with both ways out when there is none at all", () => {
    const restore = setDefaultBlockRegistry(undefined);

    try {
      expect(() =>
        render(<ContentZone blocks={[hero("Nowhere", "01")]} id="main" />),
      ).toThrow(/No block registry was given/);
    } finally {
      restore();
    }
  });

  it("is never consulted for a zone with nothing in it", () => {
    const restore = setDefaultBlockRegistry(undefined);

    try {
      const { container } = render(<ContentZone blocks={[]} id="main" />);

      expect(container.innerHTML).toBe("");
    } finally {
      restore();
    }
  });
});

describe("a block whose plugin is gone", () => {
  const missing = [{ data: { title: "Gone" }, id: "01", type: "shop:cart" }];

  it("does not take the rest of the zone down", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    render(
      <ContentZone
        blocks={[...missing, hero("Still here", "02")]}
        id="main"
        registry={registry}
      />,
    );

    expect(screen.getByRole("heading").textContent).toBe("Still here");
  });

  it("is named in a development notice", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    render(<ContentZone blocks={missing} id="main" registry={registry} />);

    expect(screen.getByRole("note").textContent).toContain(
      'Block "shop:cart" is not registered.',
    );
  });
});

describe("blocks the zone does not allow", () => {
  const mixed = [hero("Allowed", "01"), note("Refused", "02")];

  it("are skipped in development, and the rest still renders", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    render(
      <ContentZone
        allowedBlocks={["core:*"]}
        blocks={mixed}
        id="main"
        registry={registry}
      />,
    );

    expect(screen.getByRole("heading").textContent).toBe("Allowed");
    expect(screen.queryByText("Refused")).toBeNull();
    expect(screen.getByRole("note").textContent).toContain(
      'Block "example:note" is not allowed in this zone.',
    );
  });

  it("warns once, naming the zone's rule", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    render(
      <ContentZone
        allowedBlocks={["core:hero"]}
        blocks={[...mixed, note("Also refused", "03")]}
        id="main"
        registry={registry}
      />,
    );

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("does not allow it");
  });

  it("are rendered in production, where the write boundary is trusted", () => {
    vi.stubEnv("NODE_ENV", "production");

    render(
      <ContentZone
        allowedBlocks={["core:*"]}
        blocks={mixed}
        id="main"
        registry={registry}
      />,
    );

    expect(screen.getByText("Refused")).toBeDefined();
  });

  it("are skipped everywhere under validate=always", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    render(
      <ContentZone
        allowedBlocks={["core:*"]}
        blocks={mixed}
        id="main"
        registry={registry}
        validate="always"
      />,
    );

    expect(screen.queryByText("Refused")).toBeNull();
    expect(screen.getByRole("heading").textContent).toBe("Allowed");
  });

  it("are rendered under validate=never, whatever the allowlist says", () => {
    render(
      <ContentZone
        allowedBlocks={[]}
        blocks={mixed}
        id="main"
        registry={registry}
        validate="never"
      />,
    );

    expect(screen.getByText("Refused")).toBeDefined();
    expect(screen.getByRole("heading").textContent).toBe("Allowed");
  });
});

describe("the wrapper element", () => {
  it("is limited to a real DOM element, so the zone marker always lands", () => {
    const { container } = render(
      <ContentZone
        as="aside"
        blocks={[hero("Only", "01")]}
        id="main"
        registry={registry}
      />,
    );

    const wrapper = container.querySelector("aside");

    expect(wrapper?.getAttribute("data-vitnode-zone")).toBe("main");
    expect(wrapper?.children).toHaveLength(1);
  });

  it("puts the blocks inside it, never beside it", () => {
    const { container } = render(
      <ContentZone
        as="section"
        blocks={[hero("First", "01"), note("Second", "02")]}
        id="main"
        registry={registry}
      />,
    );

    expect(container.children).toHaveLength(1);
    expect(container.querySelector("section")?.children).toHaveLength(2);
  });
});

describe("the zone id", () => {
  it.each(["Main", "before profile", "main:", ""])(
    "is refused when it is %s",
    id => {
      expect(() =>
        render(
          <ContentZone
            blocks={[hero("One", "01")]}
            id={id}
            registry={registry}
          />,
        ),
      ).toThrow(/Content zone id/);
    },
  );

  it("is refused before an empty zone is allowed to render nothing", () => {
    expect(() =>
      render(<ContentZone blocks={[]} id="Main" registry={registry} />),
    ).toThrow(/Content zone id/);
  });
});

describe("server rendering", () => {
  it("produces the whole zone as markup, with no hydration hook in it", () => {
    const html = renderToStaticMarkup(
      <ContentZone
        as="section"
        blocks={[hero("Server", "01"), note("Rendered", "02")]}
        className="flex flex-col gap-6"
        id="main"
        registry={registry}
      />,
    );

    expect(html).toBe(
      '<section class="flex flex-col gap-6" data-vitnode-zone="main">' +
        "<h1>Server</h1><p>Rendered</p></section>",
    );
  });

  it("emits nothing at all for an empty zone", () => {
    expect(
      renderToStaticMarkup(
        <ContentZone blocks={[]} id="sidebar" registry={registry} />,
      ),
    ).toBe("");
  });

  it("emits no wrapper when none was asked for", () => {
    expect(
      renderToStaticMarkup(
        <ContentZone
          blocks={[hero("Bare", "01")]}
          id="main"
          registry={registry}
        />,
      ),
    ).toBe("<h1>Bare</h1>");
  });
});
