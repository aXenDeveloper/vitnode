import type { BlockComponentProps, BlockData } from "../types";

import { field } from "../../content/fields";
import { defineBlock } from "../define";

const textFields = {
  body: field.textarea({ maxLength: 20000, minLength: 1, required: true }),
  heading: field.text({ maxLength: 200, nullable: true }),
  width: field.enum({ defaultValue: "prose", values: ["prose", "full"] }),
};

type TextData = BlockData<typeof textFields>;

const paragraphs = (body: string): string[] =>
  body
    .split(/\n{2,}/)
    .map(paragraph => paragraph.trim())
    .filter(paragraph => paragraph !== "");

const Text = ({ data }: BlockComponentProps<TextData>) => (
  <section
    className={`flex flex-col gap-4 py-6 ${data.width === "full" ? "" : "max-w-prose"}`}
  >
    {data.heading ? (
      <h2 className="text-2xl font-semibold text-balance md:text-3xl">
        {data.heading}
      </h2>
    ) : null}

    {paragraphs(data.body).map(paragraph => (
      <p className="text-base leading-relaxed text-pretty" key={paragraph}>
        {paragraph}
      </p>
    ))}
  </section>
);

export const textBlock = defineBlock({
  component: Text,
  description:
    "Plain paragraphs of prose. Blank lines separate paragraphs, and nothing is parsed as markup.",
  fields: textFields,
  id: "text",
  name: "Text",
});
