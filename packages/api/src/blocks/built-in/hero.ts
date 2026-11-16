import { field } from "../../content/fields";
import { defineBlockSchema } from "../define";

export const heroBlockSchema = defineBlockSchema({
  description: "A page heading with an optional lead paragraph and one link.",
  fields: {
    align: field.enum({
      defaultValue: "start",
      values: ["start", "center"],
    }),
    description: field.textarea({ maxLength: 500, nullable: true }),
    eyebrow: field.text({ maxLength: 80, nullable: true }),
    linkHref: field.text({ maxLength: 500, nullable: true }),
    linkLabel: field.text({ maxLength: 80, nullable: true }),
    title: field.text({ maxLength: 200, minLength: 1, required: true }),
  },
  id: "hero",
  name: "Hero",
});
