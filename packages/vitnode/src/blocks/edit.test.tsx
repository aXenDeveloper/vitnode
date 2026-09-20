import { render } from "@testing-library/react";
import {
  act,
  Component,
  type ReactElement,
  type ReactNode,
  useEffect,
} from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ContentEditRuntime,
  ContentZoneMount,
  ContentZoneOutletEntry,
} from "./edit-context";

import { ContentEditorRuntime } from "./edit";
import { useContentEditRuntime } from "./edit-context";
import { BlockError } from "./errors";
import { ContentZone } from "./zone";

const seam = vi.hoisted(() => ({
  outlets: [] as readonly ContentZoneOutletEntry[],
  runtime: null as ContentEditRuntime | null,
}));

vi.mock("../editor/root", () => ({
  default: ({ outlets }: { outlets: readonly ContentZoneOutletEntry[] }) => {
    seam.outlets = outlets;

    return null;
  },
}));

const RuntimeProbe = (): null => {
  const runtime = useContentEditRuntime();

  useEffect(() => {
    seam.runtime = runtime;
  }, [runtime]);

  return null;
};

class Boundary extends Component<
  { children: ReactElement },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render(): null | ReactElement {
    return this.state.failed ? null : this.props.children;
  }
}

const editing = (children: ReactNode): ReactElement => (
  <ContentEditorRuntime enabled>{children}</ContentEditorRuntime>
);

const settled = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
  });
};

const takeRuntime = (): ContentEditRuntime => {
  const { runtime } = seam;

  if (!runtime) throw new Error("the editor runtime never reached a zone");

  return runtime;
};

const mountOf = (
  id: string,
  extra?: Partial<ContentZoneMount>,
): ContentZoneMount => ({
  allowedBlocks: undefined,
  as: undefined,
  blocks: undefined,
  className: undefined,
  fallback: undefined,
  id,
  max: undefined,
  min: undefined,
  registry: undefined,
  validate: undefined,
  ...extra,
});

const liveNode = (): HTMLElement =>
  document.body.appendChild(document.createElement("div"));

beforeEach(() => {
  seam.outlets = [];
  seam.runtime = null;
});

describe("the outlets one page hands the editor", () => {
  it("registers the zone the page renders", async () => {
    render(editing(<ContentZone id="main" />));
    await settled();

    expect(seam.outlets).toHaveLength(1);
    expect(seam.outlets[0].mount.id).toBe("main");
    expect(seam.outlets[0].node.isConnected).toBe(true);
  });

  it("keeps one registration when the same outlet changes its mount", async () => {
    const view = render(editing(<ContentZone id="main" />));
    await settled();

    const { node } = seam.outlets[0];

    view.rerender(editing(<ContentZone className="mt-4" id="main" />));
    await settled();

    expect(seam.outlets).toHaveLength(1);
    expect(seam.outlets[0].node).toBe(node);
    expect(seam.outlets[0].mount.className).toBe("mt-4");
  });

  it("hands the editor nothing new when a re-render changes nothing", async () => {
    const view = render(editing(<ContentZone id="main" />));
    await settled();

    const handed = seam.outlets;

    view.rerender(editing(<ContentZone id="main" />));
    await settled();

    expect(seam.outlets).toBe(handed);
  });

  it("registers each zone the page gives its own id", async () => {
    render(
      editing(
        <>
          <ContentZone id="main" />
          <ContentZone id="sidebar" />
        </>,
      ),
    );
    await settled();

    expect(seam.outlets.map(outlet => outlet.mount.id)).toStrictEqual([
      "main",
      "sidebar",
    ]);
  });

  it("survives the double-invoked effects of strict mode", async () => {
    render(editing(<ContentZone id="main" />), { reactStrictMode: true });
    await settled();

    expect(seam.outlets).toHaveLength(1);
  });

  it("takes the zone back off the list when the page stops rendering it", async () => {
    const view = render(
      editing(
        <>
          <ContentZone id="main" />
          <ContentZone id="sidebar" />
        </>,
      ),
    );
    await settled();

    view.rerender(editing(<ContentZone id="sidebar" />));
    await settled();

    expect(seam.outlets.map(outlet => outlet.mount.id)).toStrictEqual([
      "sidebar",
    ]);
  });
});

describe("two zones that claim the same id", () => {
  it("refuses the page instead of quietly editing one of them", async () => {
    const caught: unknown[] = [];

    render(
      <Boundary>
        {editing(
          <>
            <ContentZone id="main" />
            <ContentZone id="main" />
          </>,
        )}
      </Boundary>,
      {
        onCaughtError: error => {
          caught.push(error);
        },
      },
    );
    await settled();

    const [error] = caught;

    expect(error).toBeInstanceOf(BlockError);
    expect((error as BlockError).message).toContain('<ContentZone id="main"');
    expect((error as BlockError).message).toContain("same time");
  });

  it("says nothing when the page gives each of them its own id", async () => {
    const caught: unknown[] = [];

    render(
      <Boundary>
        {editing(
          <>
            <ContentZone id="main" />
            <ContentZone id="main-aside" />
          </>,
        )}
      </Boundary>,
      {
        onCaughtError: error => {
          caught.push(error);
        },
      },
    );
    await settled();

    expect(caught).toStrictEqual([]);
    expect(seam.outlets).toHaveLength(2);
  });
});

describe("a zone that moves to another element while the editor is open", () => {
  it("lets the replacement take the id once the old element has gone", async () => {
    render(editing(<RuntimeProbe />));
    await settled();

    const runtime = takeRuntime();
    const before = liveNode();
    const after = liveNode();

    act(() => {
      runtime.registerZone({ mount: mountOf("main"), node: before });
    });

    before.remove();

    act(() => {
      runtime.registerZone({ mount: mountOf("main"), node: after });
    });

    expect(seam.outlets).toHaveLength(1);
    expect(seam.outlets[0].node).toBe(after);
  });

  it("keeps the replacement when the old element is cleaned up afterwards", async () => {
    render(editing(<RuntimeProbe />));
    await settled();

    const runtime = takeRuntime();
    const before = liveNode();
    const after = liveNode();

    act(() => {
      runtime.registerZone({ mount: mountOf("main"), node: before });
    });

    before.remove();

    act(() => {
      runtime.registerZone({ mount: mountOf("main"), node: after });
      runtime.releaseZone({ id: "main", node: before });
    });

    expect(seam.outlets).toHaveLength(1);
    expect(seam.outlets[0].node).toBe(after);
  });

  it("releases only the outlet that registered, never its neighbours", async () => {
    render(editing(<RuntimeProbe />));
    await settled();

    const runtime = takeRuntime();
    const main = liveNode();
    const sidebar = liveNode();

    act(() => {
      runtime.registerZone({ mount: mountOf("main"), node: main });
      runtime.registerZone({ mount: mountOf("sidebar"), node: sidebar });
      runtime.releaseZone({ id: "main", node: main });
    });

    expect(seam.outlets.map(outlet => outlet.mount.id)).toStrictEqual([
      "sidebar",
    ]);
    expect(seam.outlets[0].node).toBe(sidebar);
  });

  it("refuses two elements that are both still on the page", async () => {
    render(editing(<RuntimeProbe />));
    await settled();

    const runtime = takeRuntime();
    const first = liveNode();
    const second = liveNode();

    act(() => {
      runtime.registerZone({ mount: mountOf("main"), node: first });
    });

    expect(() => {
      runtime.registerZone({ mount: mountOf("main"), node: second });
    }).toThrow(BlockError);

    expect(seam.outlets).toHaveLength(1);
    expect(seam.outlets[0].node).toBe(first);
  });
});
