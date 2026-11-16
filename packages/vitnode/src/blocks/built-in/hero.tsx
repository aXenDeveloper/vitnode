import { heroBlockSchema } from "@vitnode/api/blocks/built-in/hero";
import { PanelTopIcon } from "lucide-react";

import type { BlockComponentProps, BlockData } from "../types";

import { isValidNavigationHref } from "../../lib/navigation";
import { defineBlock } from "../define";

type HeroData = BlockData<typeof heroBlockSchema.fields>;

const Hero = ({ data }: BlockComponentProps<HeroData>) => {
  const centered = data.align === "center";

  return (
    <section
      className={`flex flex-col gap-4 py-12 md:py-16 ${centered ? "items-center text-center" : ""}`}
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

      {data.linkHref &&
      data.linkLabel &&
      isValidNavigationHref(data.linkHref) ? (
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
  ...heroBlockSchema,
  component: Hero,
  icon: PanelTopIcon,
});
