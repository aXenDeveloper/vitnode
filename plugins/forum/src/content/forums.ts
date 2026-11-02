import { defineContentContainer, field } from "@vitnode/core/content";

export const forumContainers = defineContentContainer({
  id: "forum.forums",

  fields: {
    description: field.textarea({ maxLength: 500, nullable: true }),
    icon: field.text({ maxLength: 64, nullable: true }),
  },

  hierarchy: { maxDepth: 4 },

  // Per-forum view, read, reply and download rules, set in the AdminCP. Every
  // action starts open to everyone; replying still needs a signed-in member,
  // as it always did.
  access: true,
  ordering: { mode: "manual" },

  policies: {
    defaults: {
      publish: "immediate",
      edits: "immediate",
      authorEdit: "always",
    },
  },

  publicApi: {
    path: "forums",
    fields: ["description", "icon"],
  },

  admin: { path: "forum/forums" },
});
