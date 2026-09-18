import { defineEditablePage } from "@vitnode/core/content/editor";

import { CONFIG_PLUGIN } from "@/const";

import {
  PAGE_BLOCKS_ALLOWED,
  PAGE_SIDEBAR_BLOCKS_ALLOWED,
} from "./page-blocks";

const ZONE_BLOCKS_MAX = 20;

export const EXAMPLE_SETTINGS_PAGE_ID = "example:settings";

export const EXAMPLE_WIDGETS_PERMISSION = {
  module: "widgets",
  permission: "can_edit",
} as const;

export const EXAMPLE_ZONE_IDS = {
  afterProfile: "after-profile",
  beforeFooter: "before-footer",
  beforeProfile: "before-profile",
  sidebar: "sidebar",
} as const;

export const settingsPage = defineEditablePage({
  id: EXAMPLE_SETTINGS_PAGE_ID,

  permission: EXAMPLE_WIDGETS_PERMISSION,

  zones: {
    [EXAMPLE_ZONE_IDS.beforeProfile]: {
      allowed: PAGE_BLOCKS_ALLOWED,
      max: ZONE_BLOCKS_MAX,
      default: [
        {
          data: {
            body: "Everything above and below the profile form is block content a moderator can arrange, right here. The form itself is application code and stays locked.",
            title: "This notice lives in a zone",
            tone: "info",
          },
          id: "01JEXAMPLEZONESBEFORE00001",
          type: "example:callout",
        },
        {
          data: {
            heading: "One block, three shapes",
            intro:
              "Switch this block's variant in the properties panel. The words below do not move - only the way they are laid out does.",
            primary: {
              body: "What the block says. Stored in the instance's own data and edited field by field.",
              title: "Data",
            },
            secondary: {
              body: "How this one instance presents that data. Stored as a single id beside it, never inside it.",
              title: "Variant",
            },
            tertiary: {
              body: "How blocks sit next to each other. That belongs to the area around them, not to any block.",
              title: "Layout",
            },
          },
          id: "01JEXAMPLEZONESBEFORE00002",
          type: "example:features",
          variant: "list",
        },
        {
          data: {
            body: "This zone holds three nodes, rendered in stored order. It was given no wrapper, so none of them sits inside an element the zone added.",
            heading: "Blocks at the zone root",
            width: "prose",
          },
          id: "01JEXAMPLEZONESBEFORE00003",
          type: "core:text",
        },
      ],
    },

    [EXAMPLE_ZONE_IDS.afterProfile]: {
      allowed: PAGE_BLOCKS_ALLOWED,
      max: ZONE_BLOCKS_MAX,
      default: [
        {
          children: [
            {
              data: {
                body: "Two blocks, side by side, because an area was put around them. Neither block knows it is in a column - the area is what arranges them.",
                heading: "Left column",
                width: "prose",
              },
              id: "01JEXAMPLEZONESCOL00000001",
              type: "core:text",
            },
            {
              data: {
                description: "Areas, variants and the difference between them.",
                href: "/docs/dev/blocks/layout-areas",
                label: "Read about areas",
                title: "Right column",
              },
              id: "01JEXAMPLEZONESCOL00000002",
              type: "core:cta",
            },
          ],
          id: "01JEXAMPLEZONESAREA0000001",
          kind: "area",
          layout: { align: "stretch", columns: 2, gap: "md", justify: "start" },
        },
        {
          children: [],
          id: "01JEXAMPLEZONESAREA0000002",
          kind: "area",
          layout: { align: "stretch", columns: 2, gap: "md", justify: "start" },
        },
        {
          data: {
            description:
              "Four zones sit on this page. Two of them wrap nothing.",
            href: "/docs/dev/blocks/content-zones",
            label: "Read the guide",
            title: "Content Zones",
          },
          id: "01JEXAMPLEZONESAFTERCTA001",
          type: "core:cta",
        },
      ],
    },

    [EXAMPLE_ZONE_IDS.sidebar]: {
      allowed: PAGE_SIDEBAR_BLOCKS_ALLOWED,
      max: ZONE_BLOCKS_MAX,
      default: [
        {
          data: {
            body: "This zone allows core:text and nothing else. The zones around the form take the wider allowlist. The page repeats neither: both come from the page definition.",
            heading: "A narrower zone",
            width: "prose",
          },
          id: "01JEXAMPLEZONESSIDEBAR0001",
          type: "core:text",
        },
      ],
    },

    [EXAMPLE_ZONE_IDS.beforeFooter]: {
      allowed: PAGE_BLOCKS_ALLOWED,
      max: ZONE_BLOCKS_MAX,
    },
  },
});

export interface ExampleStaffPermissions {
  permissions: readonly {
    module: string;
    permission: string;
    plugin: string;
  }[];
  root: boolean;
}

export const mayEditSettingsPage = ({
  permissions,
  root,
}: ExampleStaffPermissions): boolean =>
  root ||
  permissions.some(
    entry =>
      entry.plugin === CONFIG_PLUGIN.pluginId &&
      entry.module === EXAMPLE_WIDGETS_PERMISSION.module &&
      entry.permission === EXAMPLE_WIDGETS_PERMISSION.permission,
  );
