import { defineContentType, field } from "@vitnode/core/content";

import {
  PAGE_BLOCKS_ALLOWED,
  PAGE_SIDEBAR_BLOCKS_ALLOWED,
} from "./page-blocks";

const ZONE_BLOCKS_MAX = 20;

export const zonesLayoutContentType = defineContentType({
  id: "example.zones-layout",
  tableName: "example_zones_layouts",

  fields: {
    title: field.text({ required: true, minLength: 3, maxLength: 200 }),
    slug: field.slug({ source: "title" }),

    beforeProfile: field.blocks({
      allowed: PAGE_BLOCKS_ALLOWED,
      max: ZONE_BLOCKS_MAX,
    }),
    afterProfile: field.blocks({
      allowed: PAGE_BLOCKS_ALLOWED,
      max: ZONE_BLOCKS_MAX,
    }),
    sidebar: field.blocks({
      allowed: PAGE_SIDEBAR_BLOCKS_ALLOWED,
      max: ZONE_BLOCKS_MAX,
    }),
    beforeFooter: field.blocks({
      allowed: PAGE_BLOCKS_ALLOWED,
      max: ZONE_BLOCKS_MAX,
    }),
  },

  publication: { enabled: false },

  admin: {
    titleField: "title",
    list: {
      orderableFields: ["title"],
      searchableFields: ["title"],
    },
  },
});
