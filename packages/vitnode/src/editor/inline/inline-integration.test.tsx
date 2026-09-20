import { fireEvent, render, within } from "@testing-library/react";
import { type ReactElement, useEffect, useMemo, useReducer } from "react";
import { describe, expect, it, vi } from "vitest";

import type {
  AnyBlockInstance,
  BlockComponentProps,
  BlockData,
  ContentNode,
} from "../../blocks/types";
import type { VisualEditorContextValue } from "../context";
import type { EditorNodeRef, VisualEditorState } from "../state/types";

import { createAreaInstance, isBlockAreaInstance } from "../../blocks/area";
import { blockFieldsFor } from "../../blocks/block-field";
import { defineBlock } from "../../blocks/define";
import { createBlockInstance } from "../../blocks/instance";
import { createBlockRegistry } from "../../blocks/registry";
import { ContentRenderer } from "../../blocks/renderer";
import { blockDataShapeIssue } from "../../blocks/shape";
import { field } from "../../content/fields";
import { VisualEditorContext } from "../context";
import {
  initialVisualEditorState,
  isVisualEditorDirty,
  visualEditorReducer,
} from "../state/reducer";
import { EditorInlineBlock } from "./block";

vi.mock("use-intl", () => ({
  useLocale: () => "en",
  useTranslations:
    () =>
    (key: string, values?: Record<string, unknown>): string =>
      values === undefined
        ? key
        : `${key}:${Object.entries(values)
            .map(([name, value]) => `${name}=${String(value)}`)
            .join(",")}`,
}));

const heroFields = {
  description: field.textarea({ maxLength: 400, nullable: true }),
  title: field.text({ maxLength: 200, minLength: 1, required: true }),
};

type HeroData = BlockData<typeof heroFields>;

const HeroField = blockFieldsFor<typeof heroFields>();

const Hero = ({ data }: BlockComponentProps<HeroData>) => (
  <section className="flex flex-col gap-2">
    <HeroField name="title">
      <h1 className="text-2xl font-semibold text-balance">{data.title}</h1>
    </HeroField>
    <HeroField name="description">
      <p className="text-muted-foreground leading-relaxed text-pretty">
        {data.description}
      </p>
    </HeroField>
  </section>
);

const PlainHero = ({ data }: BlockComponentProps<HeroData>) => (
  <section className="flex flex-col gap-2">
    <h1 className="text-2xl font-semibold text-balance">{data.title}</h1>
    <p className="text-muted-foreground leading-relaxed text-pretty">
      {data.description}
    </p>
  </section>
);

const heroBlock = defineBlock({
  component: Hero,
  fields: heroFields,
  id: "hero",
  name: "Hero",
});

const plainHeroBlock = defineBlock({
  component: PlainHero,
  fields: heroFields,
  id: "hero-plain",
  name: "Plain hero",
});

const registry = createBlockRegistry([
  {
    blocks: [heroBlock, plainHeroBlock],
    namespace: "core",
    pluginId: "@vitnode/core",
  },
]);

const ZONE_ID = "main";

const hero = (data: HeroData): AnyBlockInstance =>
  createBlockInstance("core:hero", data);

const EditableNode = ({
  areaId,
  instance,
}: {
  areaId: null | string;
  instance: AnyBlockInstance;
}): ReactElement => {
  const entry = registry.get(instance.type);
  const nodeRef: EditorNodeRef = {
    areaId,
    kind: "block",
    nodeId: instance.id,
    zoneId: ZONE_ID,
  };

  return (
    <EditorInlineBlock
      definition={entry?.definition}
      instance={instance}
      nodeRef={nodeRef}
    >
      <ContentRenderer blocks={[instance]} registry={registry} />
    </EditorInlineBlock>
  );
};

interface StateTrack {
  read: () => VisualEditorState;
  write: (next: VisualEditorState) => void;
}

const track = (): StateTrack => {
  let held = initialVisualEditorState;

  return {
    read: () => held,
    write: next => {
      held = next;
    },
  };
};

const ZoneSurface = ({
  nodes,
  preview = false,
  seen,
}: {
  nodes: readonly ContentNode[];
  preview?: boolean;
  seen: StateTrack;
}): ReactElement => {
  const [state, dispatch] = useReducer(
    visualEditorReducer,
    initialVisualEditorState,
  );

  useEffect(() => {
    dispatch({
      type: "mount",
      zone: {
        allowedBlocks: undefined,
        id: ZONE_ID,
        invalid: [],
        max: undefined,
        min: undefined,
        nodes,
        registry,
      },
    });
  }, [nodes]);

  useEffect(() => {
    seen.write(state);
  }, [seen, state]);

  const mounted = state.zones[ZONE_ID]?.nodes ?? nodes;

  const editor = useMemo(
    () => ({ dispatch, preview, state }) as unknown as VisualEditorContextValue,
    [dispatch, preview, state],
  );

  if (preview) {
    return <ContentRenderer blocks={mounted} registry={registry} />;
  }

  return (
    <VisualEditorContext value={editor}>
      {mounted.map(node =>
        isBlockAreaInstance(node) ? (
          <div data-area-id={node.id} key={node.id}>
            {node.children.map(child => (
              <EditableNode areaId={node.id} instance={child} key={child.id} />
            ))}
          </div>
        ) : (
          <EditableNode areaId={null} instance={node} key={node.id} />
        ),
      )}
    </VisualEditorContext>
  );
};

const typeInto = (node: HTMLElement, text: string): void => {
  node.textContent = text;
  fireEvent.input(node);
};

const LOCALE_CODES = new Set(["de", "en", "es", "fr", "pl", "pt-BR"]);

const holdsLocaleMap = (value: unknown): boolean => {
  if (typeof value !== "object" || value === null) return false;
  if (Array.isArray(value)) return value.some(holdsLocaleMap);

  const keys = Object.keys(value);

  if (keys.length > 0 && keys.every(key => LOCALE_CODES.has(key))) return true;

  return Object.values(value).some(holdsLocaleMap);
};

const zoneNodes = (seen: StateTrack): readonly ContentNode[] =>
  seen.read().zones[ZONE_ID]?.nodes ?? [];

const dataOf = (node: ContentNode | undefined): Record<string, unknown> =>
  node && !isBlockAreaInstance(node) ? node.data : {};

const headingIn = (element: HTMLElement): HTMLElement =>
  within(element).getByRole("heading", { level: 1 });

const fieldIn = (element: HTMLElement, name: string): HTMLElement => {
  const found = element.querySelector<HTMLElement>(
    `[data-vitnode-inline-field="${name}"]`,
  );

  if (found === null) {
    throw new Error(`no inline field "${name}" is rendered here`);
  }

  return found;
};

describe("a block with inline fields on a page nobody is editing", () => {
  const data: HeroData = {
    description: "Somewhere to put the rest of it.",
    title: "Hello",
  };

  it("renders exactly the markup the same block renders without BlockField", () => {
    const wrapped = render(
      <ContentRenderer blocks={[hero(data)]} registry={registry} />,
    );
    const plain = render(
      <ContentRenderer
        blocks={[createBlockInstance("core:hero-plain", data)]}
        registry={registry}
      />,
    );

    expect(wrapped.container.innerHTML).toBe(plain.container.innerHTML);
  });

  it("carries no contenteditable and draws no placeholder", () => {
    const { container } = render(
      <ContentRenderer
        blocks={[hero({ description: "", title: "Hello" })]}
        registry={registry}
      />,
    );

    expect(container.querySelector("[contenteditable]")).toBeNull();
    expect(
      container.querySelector("[data-vitnode-inline-placeholder]"),
    ).toBeNull();
    expect(container.innerHTML).not.toContain("contenteditable");
  });
});

describe("editing a block by typing into the page", () => {
  it("writes the typed text into the same block.data the panel edits", () => {
    const seen = track();
    const nodes = [hero({ description: "Body", title: "Hello" })];
    const { container } = render(<ZoneSurface nodes={nodes} seen={seen} />);

    typeInto(fieldIn(container, "title"), "Hello there");

    expect(dataOf(zoneNodes(seen)[0])).toStrictEqual({
      description: "Body",
      title: "Hello there",
    });
    expect(isVisualEditorDirty(seen.read())).toBe(true);
  });

  it("leaves data that still fits the block's own fields, with nothing new in it", () => {
    const seen = track();
    const nodes = [hero({ description: "Body", title: "Hello" })];
    const { container } = render(<ZoneSurface nodes={nodes} seen={seen} />);

    typeInto(fieldIn(container, "title"), "Edited");

    const data = dataOf(zoneNodes(seen)[0]);

    expect(Object.keys(data).toSorted()).toStrictEqual(
      Object.keys(heroFields).toSorted(),
    );
    expect(blockDataShapeIssue(heroBlock, data)).toBeNull();
    expect(holdsLocaleMap(data)).toBe(false);
  });

  it("draws a placeholder for an empty field and never stores it", () => {
    const seen = track();
    const nodes = [hero({ description: "", title: "Hello" })];
    const { container } = render(<ZoneSurface nodes={nodes} seen={seen} />);

    const empty = container.querySelector<HTMLElement>(
      '[data-vitnode-inline-field="description"]',
    );

    expect(empty?.dataset.vitnodeInlinePlaceholder).toContain("inline.empty");
    expect(empty?.dataset.vitnodeInlinePlaceholder).toContain("Description");
    expect(empty?.textContent).toBe("");
    expect(dataOf(zoneNodes(seen)[0]).description).toBe("");
  });
});

describe("the same zone mounted with another language's snapshot", () => {
  const english = [hero({ description: "The English body.", title: "Hello" })];
  const polish = [hero({ description: "Polska treść.", title: "Cześć" })];

  it("adopts the incoming snapshot and leaves no stale text behind", () => {
    const seen = track();
    const { container, rerender } = render(
      <ZoneSurface nodes={english} seen={seen} />,
    );

    expect(fieldIn(container, "title").textContent).toBe("Hello");

    rerender(<ZoneSurface nodes={polish} seen={seen} />);

    expect(fieldIn(container, "title").textContent).toBe("Cześć");
    expect(container.textContent).not.toContain("Hello");
    expect(container.textContent).not.toContain("The English body.");
  });

  it("introduces no per-field locale structure when a language is edited", () => {
    const seen = track();
    const { container, rerender } = render(
      <ZoneSurface nodes={english} seen={seen} />,
    );

    rerender(<ZoneSurface nodes={polish} seen={seen} />);
    typeInto(fieldIn(container, "title"), "Witaj");

    const data = dataOf(zoneNodes(seen)[0]);

    expect(data).toStrictEqual({
      description: "Polska treść.",
      title: "Witaj",
    });
    expect(holdsLocaleMap(data)).toBe(false);
    expect(blockDataShapeIssue(heroBlock, data)).toBeNull();
  });

  it("keeps an unsaved edit when the other language arrives underneath it", () => {
    const seen = track();
    const { container, rerender } = render(
      <ZoneSurface nodes={english} seen={seen} />,
    );

    typeInto(fieldIn(container, "title"), "Edited");
    rerender(<ZoneSurface nodes={polish} seen={seen} />);

    expect(dataOf(zoneNodes(seen)[0]).title).toBe("Edited");
    expect(isVisualEditorDirty(seen.read())).toBe(true);
  });
});

describe("preview", () => {
  it("makes no inline field editable and draws no placeholder", () => {
    const seen = track();
    const nodes = [hero({ description: "", title: "Hello" })];
    const { container } = render(
      <ZoneSurface nodes={nodes} preview seen={seen} />,
    );

    expect(container.querySelector("[contenteditable]")).toBeNull();
    expect(container.querySelector("[data-vitnode-inline-field]")).toBeNull();
    expect(
      container.querySelector("[data-vitnode-inline-placeholder]"),
    ).toBeNull();
    expect(headingIn(container).textContent).toBe("Hello");
  });
});

describe("a block inside an area", () => {
  const inside = hero({ description: "In the area.", title: "Child" });
  const outside = hero({ description: "At the root.", title: "Root" });
  const area = createAreaInstance({ children: [inside] });

  it("is edited through its own zone, area and node", () => {
    const seen = track();
    const nodes = [outside, area];
    const { container } = render(<ZoneSurface nodes={nodes} seen={seen} />);

    const frame = container.querySelector<HTMLElement>(
      `[data-area-id="${area.id}"]`,
    );

    if (!frame) throw new Error("The area did not render a frame to edit in.");

    typeInto(fieldIn(frame, "title"), "Child edited");

    const [root, edited] = zoneNodes(seen);

    expect(dataOf(root).title).toBe("Root");
    expect(isBlockAreaInstance(edited)).toBe(true);
    expect(
      dataOf(isBlockAreaInstance(edited) ? edited.children[0] : undefined)
        .title,
    ).toBe("Child edited");
  });

  it("is not reachable by a ref that forgets the area", () => {
    const state = visualEditorReducer(initialVisualEditorState, {
      type: "mount",
      zone: {
        allowedBlocks: undefined,
        id: ZONE_ID,
        invalid: [],
        max: undefined,
        min: undefined,
        nodes: [outside, area],
        registry,
      },
    });

    const next = visualEditorReducer(state, {
      data: { title: "Written to nowhere" },
      ref: { areaId: null, kind: "block", nodeId: inside.id, zoneId: ZONE_ID },
      type: "update",
    });

    expect(next).toBe(state);
    expect(isVisualEditorDirty(next)).toBe(false);
  });
});
