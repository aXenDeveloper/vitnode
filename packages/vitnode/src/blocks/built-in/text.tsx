import { textBlockSchema } from "@vitnode/api/blocks/built-in/text";
import { TypeIcon } from "lucide-react";

import type { BlockComponentProps, BlockData } from "../types";

import { defineBlock } from "../define";

type TextData = BlockData<typeof textBlockSchema.fields>;

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
  ...textBlockSchema,
  component: Text,
  icon: TypeIcon,
});
