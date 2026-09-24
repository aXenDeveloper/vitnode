import { MegaphoneIcon } from "lucide-react";

import type { BlockComponentProps, BlockData } from "../types";

import { field } from "../../content/fields";
import { defineBlock } from "../define";

const ctaFields = {
  description: field.textarea({ maxLength: 300, nullable: true }),
  href: field.text({ maxLength: 500, minLength: 1, required: true }),
  label: field.text({ maxLength: 80, minLength: 1, required: true }),
  title: field.text({ maxLength: 160, minLength: 1, required: true }),
};

type CtaData = BlockData<typeof ctaFields>;

const Cta = ({ data }: BlockComponentProps<CtaData>) => (
  <section className="border-border bg-muted/40 flex flex-col gap-4 rounded-lg border p-6 md:flex-row md:items-center md:justify-between md:p-8">
    <div className="flex flex-col gap-2">
      <h2 className="text-xl font-semibold text-balance md:text-2xl">
        {data.title}
      </h2>
      {data.description ? (
        <p className="text-muted-foreground text-sm leading-relaxed text-pretty md:text-base">
          {data.description}
        </p>
      ) : null}
    </div>

    <a
      className="bg-primary text-primary-foreground hover:bg-primary/80 focus-visible:ring-ring/50 inline-flex w-fit shrink-0 items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:outline-none"
      href={data.href}
    >
      {data.label}
    </a>
  </section>
);

export const ctaBlock = defineBlock({
  component: Cta,
  description: "A short call to action with one link.",
  fields: ctaFields,
  icon: MegaphoneIcon,
  id: "cta",
  name: "Call to action",
});
