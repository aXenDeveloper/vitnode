import { cn } from "cn";

import type { BlockComponentProps, BlockData } from "../types";

import { field } from "../../content/fields";
import { defineBlock } from "../define";

const heroFields = {
  align: field.enum({
    defaultValue: "start",
    values: ["start", "center"],
  }),
  description: field.textarea({ maxLength: 500, nullable: true }),
  eyebrow: field.text({ maxLength: 80, nullable: true }),
  linkHref: field.text({ maxLength: 500, nullable: true }),
  linkLabel: field.text({ maxLength: 80, nullable: true }),
  title: field.text({ maxLength: 200, minLength: 1, required: true }),
};

type HeroData = BlockData<typeof heroFields>;

const Hero = ({ data }: BlockComponentProps<HeroData>) => {
  const centered = data.align === "center";

  return (
    <section
      className={cn(
        "flex flex-col gap-4 py-12 md:py-16",
        centered && "items-center text-center",
      )}
    >
      {data.eyebrow ? (
        <p className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
          {data.eyebrow}
        </p>
      ) : null}

      <h1 className="text-3xl font-semibold text-balance md:text-5xl">
        {data.title}
      </h1>

      {data.description ? (
        <p className="text-muted-foreground max-w-2xl text-base leading-relaxed text-pretty md:text-lg">
          {data.description}
        </p>
      ) : null}

      {data.linkHref && data.linkLabel ? (
        <a
          className="bg-primary text-primary-foreground hover:bg-primary/80 focus-visible:ring-ring/50 inline-flex w-fit items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:outline-none"
          href={data.linkHref}
        >
          {data.linkLabel}
        </a>
      ) : null}
    </section>
  );
};

export const heroBlock = defineBlock({
  component: Hero,
  description: "A page heading with an optional lead paragraph and one link.",
  fields: heroFields,
  id: "hero",
  name: "Hero",
});
