import type { WidgetComponentProps, WidgetData } from "@vitnode/core/widgets";

import { defineWidget } from "@vitnode/core/widgets";
import { SparklesIcon } from "lucide-react";

import { featuresSchema } from "./features.schema";

type FeaturesData = WidgetData<typeof featuresSchema.fields>;

type FeatureItem = NonNullable<FeaturesData["primary"]>;

interface FeatureSlot {
  item: FeatureItem;
  slot: string;
}

const filledItems = (data: FeaturesData): FeatureSlot[] =>
  (
    [
      { item: data.primary, slot: "primary" },
      { item: data.secondary, slot: "secondary" },
      { item: data.tertiary, slot: "tertiary" },
    ] as const
  ).flatMap(({ item, slot }) => (item?.title ? [{ item, slot }] : []));

const GridItem = ({ item }: { item: FeatureItem }) => (
  <li className="border-border bg-card flex flex-col gap-2 rounded-lg border p-4">
    <h3 className="text-base leading-relaxed font-semibold text-balance">
      {item.title}
    </h3>
    {item.body ? (
      <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
        {item.body}
      </p>
    ) : null}
  </li>
);

const ListItem = ({ item }: { item: FeatureItem }) => (
  <li className="flex flex-col gap-1">
    <h3 className="text-base leading-relaxed font-semibold text-balance">
      {item.title}
    </h3>
    {item.body ? (
      <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
        {item.body}
      </p>
    ) : null}
  </li>
);

const CompactItem = ({ item }: { item: FeatureItem }) => (
  <li className="flex items-center gap-2">
    <span className="bg-primary size-1.5 rounded-full" />
    <span className="text-sm font-medium">{item.title}</span>
  </li>
);

const Features = ({
  data,
  variant,
}: WidgetComponentProps<FeaturesData, "compact" | "grid" | "list">) => {
  const items = filledItems(data);
  const compact = variant === "compact";

  return (
    <section className="flex flex-col gap-6 py-4">
      <div className="flex flex-col gap-2">
        <h2
          className={
            compact
              ? "text-base font-semibold text-balance"
              : "text-xl font-semibold text-balance md:text-2xl"
          }
        >
          {data.heading}
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
          {data.intro}
        </p>
      </div>

      {variant === "list" ? (
        <ul className="flex flex-col gap-4">
          {items.map(({ item, slot }) => (
            <ListItem item={item} key={slot} />
          ))}
        </ul>
      ) : null}

      {compact ? (
        <ul className="flex flex-col gap-1">
          {items.map(({ item, slot }) => (
            <CompactItem item={item} key={slot} />
          ))}
        </ul>
      ) : null}

      {variant === "list" || compact ? null : (
        <ul className="grid gap-4 md:grid-cols-3">
          {items.map(({ item, slot }) => (
            <GridItem item={item} key={slot} />
          ))}
        </ul>
      )}
    </section>
  );
};

export const featuresWidget = defineWidget({
  ...featuresSchema,
  component: Features,
  icon: SparklesIcon,
});

export const featuresBlock = featuresWidget;
