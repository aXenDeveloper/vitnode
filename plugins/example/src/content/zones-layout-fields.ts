import type { AnyBlockInstance } from "@vitnode/core/blocks";

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

export type ExampleZonesFields = Record<ExampleZoneField, AnyBlockInstance[]>;

export type ExampleZonesRecord = Record<ExampleZoneId, AnyBlockInstance[]>;

export const EXAMPLE_ZONE_FIELDS = Object.keys(
  EXAMPLE_ZONE_IDS,
) as ExampleZoneField[];

export const fieldsToZones = (fields: ExampleZonesFields): ExampleZonesRecord =>
  EXAMPLE_ZONE_FIELDS.reduce<ExampleZonesRecord>(
    (zones, field) => ({ ...zones, [EXAMPLE_ZONE_IDS[field]]: fields[field] }),
    {} as ExampleZonesRecord,
  );

export const zonesToFields = (
  zones: Readonly<Record<string, readonly AnyBlockInstance[] | undefined>>,
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
      data: {
        description: "Four zones sit on this page. Two of them wrap nothing.",
        href: "/docs/dev/blocks/content-zones",
        label: "Read the guide",
        title: "Content Zones",
      },
      id: "01JEXAMPLEZONESAFTERCTA01",
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
      id: "01JEXAMPLEZONESBEFORE0001",
      type: "example:callout",
    },
    {
      data: {
        body: "This zone holds two blocks, rendered in stored order. It was given no wrapper, so neither of them sits inside an element the zone added.",
        heading: "Two blocks, one zone",
        width: "prose",
      },
      id: "01JEXAMPLEZONESBEFORE0002",
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
      id: "01JEXAMPLEZONESSIDEBAR001",
      type: "core:text",
    },
  ],
};
