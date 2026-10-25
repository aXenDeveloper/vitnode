import { defineContentContainer, field } from "@vitnode/core/content";

export const deskContainers = defineContentContainer({
  id: "newsroom.desks",

  fields: {
    description: field.textarea({ maxLength: 500, nullable: true }),
    color: field.text({ maxLength: 7, nullable: true }),
    icon: field.text({ maxLength: 64, nullable: true }),
    locked: field.boolean({ defaultValue: false }),
  },

  hierarchy: { maxDepth: 3 },
  ordering: { mode: "manual" },

  publicApi: {
    path: "desks",
    fields: ["description", "color", "icon"],
  },

  admin: { path: "newsroom/desks" },
});
