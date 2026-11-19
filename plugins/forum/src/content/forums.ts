import { defineContentContainer, field } from "@vitnode/api/content";

export const forumContainers = defineContentContainer({
  id: "forum.forums",

  localization: { defaultLocale: "en" },

  fields: {
    description: field.textarea({
      localized: true,
      maxLength: 500,
      nullable: true,
    }),
    icon: field.icon({ nullable: true }),
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
