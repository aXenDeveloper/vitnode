import type { ContentNode } from "@vitnode/core/blocks";

export const EXAMPLE_ZONES_LAYOUT_SLUG = "settings-playground";

export const EXAMPLE_ZONES_LAYOUT_TITLE = "Settings playground";

export const EXAMPLE_ZONE_IDS = {
  afterProfile: "settings:after-profile",
  beforeFooter: "settings:before-footer",
  beforeProfile: "settings:before-profile",
  sidebar: "settings:sidebar",
} as const;

export type ExampleZoneField = keyof typeof EXAMPLE_ZONE_IDS;

export type ExampleZoneId = (typeof EXAMPLE_ZONE_IDS)[ExampleZoneField];

export type ExampleZonesFields = Record<ExampleZoneField, ContentNode[]>;

export type ExampleZonesRecord = Record<ExampleZoneId, ContentNode[]>;

export const EXAMPLE_ZONE_FIELDS = Object.keys(
  EXAMPLE_ZONE_IDS,
) as ExampleZoneField[];

export interface ZonesLayout {
  source: "defaults" | "stored";
  updatedAt: null | string;
  zones: ExampleZonesRecord;
}

export const fieldsToZones = (fields: ExampleZonesFields): ExampleZonesRecord =>
  EXAMPLE_ZONE_FIELDS.reduce<ExampleZonesRecord>(
    (zones, field) => ({ ...zones, [EXAMPLE_ZONE_IDS[field]]: fields[field] }),
    {} as ExampleZonesRecord,
  );

export const zonesToFields = (
  zones: Readonly<Record<string, readonly ContentNode[] | undefined>>,
  fallback: ExampleZonesFields,
): ExampleZonesFields =>
  EXAMPLE_ZONE_FIELDS.reduce<ExampleZonesFields>(
    (fields, field) => ({
      ...fields,
      [field]: [...(zones[EXAMPLE_ZONE_IDS[field]] ?? fallback[field])],
    }),
    {} as ExampleZonesFields,
  );

export const DEFAULT_EXAMPLE_ZONES_LAYOUT: ExampleZonesFields = {
  afterProfile: [
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
      layout: { align: "stretch", columns: 2, gap: "md" },
    },
    {
      children: [],
      id: "01JEXAMPLEZONESAREA0000002",
      kind: "area",
      layout: { align: "stretch", columns: 2, gap: "md" },
    },
    {
      data: {
        description: "Four zones sit on this page. Two of them wrap nothing.",
        href: "/docs/dev/blocks/content-zones",
        label: "Read the guide",
        title: "Content Zones",
      },
      id: "01JEXAMPLEZONESAFTERCTA001",
      type: "core:cta",
    },
  ],

  beforeFooter: [],

  beforeProfile: [
    {
      data: {
        body: "Everything above and below the profile form is block content an editor will be able to arrange. The form itself is application code and stays locked.",
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

  sidebar: [
    {
      data: {
        body: "This zone allows core:text and nothing else, while the zones around the form take the same allowlist the page content type declares.",
        heading: "A narrower zone",
        width: "prose",
      },
      id: "01JEXAMPLEZONESSIDEBAR0001",
      type: "core:text",
    },
  ],
};

export const toZonesLayout = (payload: {
  fields: ExampleZonesFields;
  source: "defaults" | "stored";
  updatedAt: null | string;
}): ZonesLayout => ({
  source: payload.source,
  updatedAt: payload.updatedAt,
  zones: fieldsToZones(payload.fields),
});
