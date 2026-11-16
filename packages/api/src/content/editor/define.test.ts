import { describe, expect, it } from "vitest";

import type { AnyBlockInstance, BlockAreaInstance } from "../../blocks/types";

import { ContentEngineError } from "../errors";
import { defineEditablePage, editablePageZone } from "./define";

const PERMISSION = { module: "widgets", permission: "can_edit" };

const block = (id: string): AnyBlockInstance => ({
  data: { heading: "Welcome" },
  id,
  type: "core:text",
});

const area = (
  id: string,
  children: AnyBlockInstance[] = [],
): BlockAreaInstance => ({
  children,
  id,
  kind: "area",
  layout: { columns: 2 },
});

const settings = defineEditablePage({
  id: "example:settings",
  permission: PERMISSION,
  zones: {
    "before-profile": { allowed: ["core:text", "core:cta"], max: 20 },
    sidebar: { allowed: ["core:text"], default: [block("welcome")], max: 5 },
  },
});

describe("defineEditablePage", () => {
  it("keeps the page's identity, its permission and its zone order", () => {
    expect(settings.id).toBe("example:settings");
    expect(settings.permission).toStrictEqual({
      module: "widgets",
      permission: "can_edit",
    });
    expect(settings.zoneIds).toStrictEqual(["before-profile", "sidebar"]);
  });

  it("carries each zone's own allowlist, bounds and shipped default", () => {
    expect(settings.zones.sidebar).toStrictEqual({
      allowed: ["core:text"],
      default: [block("welcome")],
      max: 5,
      min: undefined,
      zoneId: "sidebar",
    });
  });

  it("takes every installed block when a zone names no allowlist", () => {
    const page = defineEditablePage({
      id: "example:home",
      permission: PERMISSION,
      zones: { main: {} },
    });

    expect(page.zones.main).toStrictEqual({
      allowed: "*",
      default: [],
      max: undefined,
      min: undefined,
      zoneId: "main",
    });
  });

  it("takes an area as a shipped default, not only a block", () => {
    const page = defineEditablePage({
      id: "example:home",
      permission: PERMISSION,
      zones: { main: { default: [area("layout"), block("under")] } },
    });

    expect(page.zones.main.default).toHaveLength(2);
  });

  it("refuses a page id that is not `plugin:page`", () => {
    expect(() =>
      defineEditablePage({
        id: "Example Settings",
        permission: PERMISSION,
        zones: { main: {} },
      }),
    ).toThrow(/is not usable/);

    expect(() =>
      defineEditablePage({
        id: "settings",
        permission: PERMISSION,
        zones: { main: {} },
      }),
    ).toThrow(ContentEngineError);
  });

  it("refuses a page that declares no zones", () => {
    expect(() =>
      defineEditablePage({
        id: "example:settings",
        permission: PERMISSION,
        zones: {},
      }),
    ).toThrow(/declares no zones/);
  });

  it("refuses a zone id the renderer could not address", () => {
    expect(() =>
      defineEditablePage({
        id: "example:settings",
        permission: PERMISSION,
        zones: { "Before Profile": {} },
      }),
    ).toThrow(ContentEngineError);
  });

  it("refuses a permission it cannot check rather than gating on nothing", () => {
    expect(() =>
      defineEditablePage({
        id: "example:settings",
        // @ts-expect-error - a permission is `{ module, permission }`
        permission: "can_edit",
        zones: { main: {} },
      }),
    ).toThrow(/declares a `permission` that is not usable/);

    expect(() =>
      defineEditablePage({
        id: "example:settings",
        // @ts-expect-error - `module` is required
        permission: { permission: "can_edit" },
        zones: { main: {} },
      }),
    ).toThrow(/declares a `permission` that is not usable/);

    expect(() =>
      defineEditablePage({
        id: "example:settings",
        permission: { module: "", permission: "can_edit" },
        zones: { main: {} },
      }),
    ).toThrow(/declares a `permission` that is not usable/);
  });

  it("refuses a plugin that is not a name, which would check another plugin's module", () => {
    expect(() =>
      defineEditablePage({
        id: "example:settings",
        // @ts-expect-error - a plugin is a string
        permission: { module: "widgets", permission: "can_edit", plugin: 7 },
        zones: { main: {} },
      }),
    ).toThrow(/`plugin` is not a name/);
  });

  it("keeps a plugin the page named, and leaves it out when it named none", () => {
    const elsewhere = defineEditablePage({
      id: "example:settings",
      permission: {
        module: "widgets",
        permission: "can_edit",
        plugin: "@vitnode/core",
      },
      zones: { main: {} },
    });

    expect(elsewhere.permission.plugin).toBe("@vitnode/core");
    expect("plugin" in settings.permission).toBe(false);
  });

  it("refuses an allowlist it would otherwise have widened to `*`", () => {
    expect(() =>
      defineEditablePage({
        id: "example:settings",
        permission: PERMISSION,
        // @ts-expect-error - an allowlist is `"*"` or a list of block ids
        zones: { main: { allowed: { "core:text": true } } },
      }),
    ).toThrow(/not a block allowlist/);
  });

  it("refuses an allowlist that allows nothing at all", () => {
    expect(() =>
      defineEditablePage({
        id: "example:settings",
        permission: PERMISSION,
        zones: { main: { allowed: [] } },
      }),
    ).toThrow(/allows no blocks at all/);
  });

  it("refuses an allowlist entry that is not a block id", () => {
    expect(() =>
      defineEditablePage({
        id: "example:settings",
        permission: PERMISSION,
        zones: { main: { allowed: ["text"] } },
      }),
    ).toThrow(/which is not a block id/);
  });

  it("refuses bounds that count nothing a zone could hold", () => {
    expect(() =>
      defineEditablePage({
        id: "example:settings",
        permission: PERMISSION,
        zones: { main: { max: 2.5 } },
      }),
    ).toThrow(/declares a `max`/);

    expect(() =>
      defineEditablePage({
        id: "example:settings",
        permission: PERMISSION,
        zones: { main: { min: -1 } },
      }),
    ).toThrow(/declares a `min`/);

    expect(() =>
      defineEditablePage({
        id: "example:settings",
        permission: PERMISSION,
        zones: { main: { max: 1, min: 3 } },
      }),
    ).toThrow(/min 3 greater than max 1/);
  });

  it("refuses a default holding something that is not a content node", () => {
    expect(() =>
      defineEditablePage({
        id: "example:settings",
        permission: PERMISSION,
        // @ts-expect-error - a default holds blocks and areas
        zones: { main: { default: [{ heading: "Welcome" }] } },
      }),
    ).toThrow(/entry 0 is neither a block nor an area/);
  });

  it("refuses a default the zone's own bounds would reject on the first save", () => {
    expect(() =>
      defineEditablePage({
        id: "example:settings",
        permission: PERMISSION,
        zones: { main: { default: [block("a"), block("b")], max: 1 } },
      }),
    ).toThrow(/more than the 1 it allows/);

    expect(() =>
      defineEditablePage({
        id: "example:settings",
        permission: PERMISSION,
        zones: { main: { default: [block("a")], min: 2 } },
      }),
    ).toThrow(/fewer than the 2 it requires/);

    expect(() =>
      defineEditablePage({
        id: "example:settings",
        permission: PERMISSION,
        zones: { main: { min: 1 } },
      }),
    ).toThrow(/fewer than the 1 it requires/);
  });

  it("refuses a default the zone's own save would throw out", () => {
    const wide = {
      ...area("ar1"),
      children: Array.from({ length: 51 }, (_, at) => block(`b${at}`)),
    };

    expect(() =>
      defineEditablePage({
        id: "example:settings",
        permission: PERMISSION,
        zones: { main: { default: [wide] } },
      }),
    ).toThrow(/holds 51 children, and an area holds at most 50/);

    expect(() =>
      defineEditablePage({
        id: "example:settings",
        permission: PERMISSION,
        zones: {
          main: {
            default: [
              {
                ...area("ar1"),
                children: [area("ar2")] as never,
              },
            ],
          },
        },
      }),
    ).toThrow(/holds another area/);

    expect(() =>
      defineEditablePage({
        id: "example:settings",
        permission: PERMISSION,
        zones: { main: { default: [block("same"), block("same")] } },
      }),
    ).toThrow(/uses the instance id "same" more than once/);

    expect(() =>
      defineEditablePage({
        id: "example:settings",
        permission: PERMISSION,
        zones: {
          main: { default: [block("same"), area("ar1", [block("same")])] },
        },
      }),
    ).toThrow(/uses the instance id "same" more than once/);
  });

  it("refuses a min the zone's own ceiling puts out of reach", () => {
    expect(() =>
      defineEditablePage({
        id: "example:settings",
        permission: PERMISSION,
        zones: { main: { min: 201 } },
      }),
    ).toThrow(/stores at most 200 blocks unless it raises/);
  });

  it("counts the blocks inside an area, and never the area itself", () => {
    expect(() =>
      defineEditablePage({
        id: "example:settings",
        permission: PERMISSION,
        zones: {
          main: { default: [area("ar1", [block("b1"), block("b2")])], max: 1 },
        },
      }),
    ).toThrow(/ships 2 blocks by default, which is more than the 1/);

    expect(() =>
      defineEditablePage({
        id: "example:settings",
        permission: PERMISSION,
        zones: { main: { default: [area("ar1")], min: 1 } },
      }),
    ).toThrow(/ships 0 blocks by default, which is fewer than the 1/);

    expect(() =>
      defineEditablePage({
        id: "example:settings",
        permission: PERMISSION,
        zones: {
          main: { default: [area("ar1", [block("b1")])], max: 1, min: 1 },
        },
      }),
    ).not.toThrow();

    expect(() =>
      defineEditablePage({
        id: "example:settings",
        permission: PERMISSION,
        zones: {
          main: {
            default: [block("b1"), area("ar1", [block("b2"), block("b3")])],
            max: 2,
          },
        },
      }),
    ).toThrow(/ships 3 blocks by default, which is more than the 2/);
  });

  it("refuses a zone declared as something other than an object", () => {
    expect(() =>
      defineEditablePage({
        id: "example:settings",
        permission: PERMISSION,
        // @ts-expect-error - a zone is declared with an object
        zones: { main: "core:text" },
      }),
    ).toThrow(/is not declared with an object/);
  });
});

describe("zone props", () => {
  it("hands `ContentZone` exactly the props it takes", () => {
    expect(settings.zone("sidebar")).toStrictEqual({
      allowedBlocks: ["core:text"],
      id: "sidebar",
    });
  });

  it("throws for a zone the page does not declare, naming the ones it does", () => {
    expect(() => settings.zone("footer" as "sidebar")).toThrow(
      /has no zone "footer". It declares "before-profile", "sidebar"/,
    );
    expect(() => editablePageZone(settings, "footer")).toThrow(
      ContentEngineError,
    );
    expect(editablePageZone(settings, "sidebar").max).toBe(5);
  });
});
