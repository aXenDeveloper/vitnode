import { field } from "../../content/fields";
import { defineBlockSchema } from "../define";

export const ctaBlockSchema = defineBlockSchema({
  description: "A short call to action with one link.",
  fields: {
    description: field.textarea({ maxLength: 300, nullable: true }),
    href: field.text({ maxLength: 500, minLength: 1, required: true }),
    label: field.text({ maxLength: 80, minLength: 1, required: true }),
    title: field.text({ maxLength: 160, minLength: 1, required: true }),
  },
  id: "cta",
  name: "Call to action",
});
