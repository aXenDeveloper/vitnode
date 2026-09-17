import { createContentModel } from "@vitnode/core/content/server";

import { zonesLayoutContentType } from "@/content/zones-layout";

export const zonesLayoutContent = createContentModel(zonesLayoutContentType);

export const example_zones_layouts = zonesLayoutContent.table;
