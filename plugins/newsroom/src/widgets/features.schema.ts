import { defineWidgetSchema } from "@vitnode/api/blocks";
import { field } from "@vitnode/api/content/fields";

const featureItem = {
  body: field.textarea({ maxLength: 240, nullable: true }),
  title: field.text({ maxLength: 80, minLength: 1, required: true }),
};

export const featuresSchema = defineWidgetSchema({
  defaultVariant: "grid",
  description:
    "Up to three features, told the same way in three different shapes.",
  fields: {
    heading: field.text({ maxLength: 120, minLength: 1, required: true }),
    intro: field.textarea({ maxLength: 300, nullable: true }),
    primary: field.group({ fields: featureItem }),
    secondary: field.group({ fields: featureItem, nullable: true }),
    tertiary: field.group({ fields: featureItem, nullable: true }),
  },
  id: "features",
  name: "Features",
  variants: [
    { description: "Cards side by side.", id: "grid", label: "Grid" },
    {
      description: "One per row, with room to explain.",
      id: "list",
      label: "List",
    },
    { description: "A dense summary.", id: "compact", label: "Compact" },
  ],
});
