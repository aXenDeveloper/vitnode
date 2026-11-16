import { field } from "../../content/fields";
import { defineBlockSchema } from "../define";

export const textBlockSchema = defineBlockSchema({
  description:
    "Plain paragraphs of prose. Blank lines separate paragraphs, and nothing is parsed as markup.",
  fields: {
    body: field.textarea({ maxLength: 20000, minLength: 1, required: true }),
    heading: field.text({ maxLength: 200, nullable: true }),
    width: field.enum({ defaultValue: "prose", values: ["prose", "full"] }),
  },
  id: "text",
  name: "Text",
});
