import { defineWidgetSchema } from "@vitnode/api/blocks";
import { field } from "@vitnode/api/content/fields";

export const calloutSchema = defineWidgetSchema({
  description: "A short highlighted note in one of three tones.",
  fields: {
    body: field.textarea({ maxLength: 600, minLength: 1, required: true }),
    title: field.text({ maxLength: 120, minLength: 1, required: true }),
    tone: field.enum({
      defaultValue: "info",
      values: ["info", "success", "warning"],
    }),
  },
  id: "callout",
  name: "Callout",
});
