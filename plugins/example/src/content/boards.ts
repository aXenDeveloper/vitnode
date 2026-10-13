import { defineContentContainer, field } from "@vitnode/core/content";

/**
 * Discussion boards: one collection of containers, one content type
 * (`example.discussion`) filed into it. An admin builds the tree; members post
 * into whichever board they pick.
 */
export const boardContainers = defineContentContainer({
  id: "example.boards",

  fields: {
    description: field.textarea({ maxLength: 500, nullable: true }),
    color: field.text({ maxLength: 7, nullable: true }),
    icon: field.text({ maxLength: 64, nullable: true }),
    locked: field.boolean({ defaultValue: false }),
  },

  hierarchy: { maxDepth: 3 },
  ordering: { mode: "manual" },

  publicApi: {
    path: "boards",
    fields: ["description", "color", "icon"],
  },

  admin: { path: "example/boards" },
});
