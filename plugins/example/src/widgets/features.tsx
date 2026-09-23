import type { WidgetComponentProps, WidgetData } from "@vitnode/core/widgets";

import { field } from "@vitnode/core/content/fields";
import { defineWidget } from "@vitnode/core/widgets";

const featureItem = {
  body: field.textarea({ maxLength: 240, nullable: true }),
  title: field.text({ maxLength: 80, minLength: 1, required: true }),
};

const featuresFields = {
  heading: field.text({ maxLength: 120, minLength: 1, required: true }),
  intro: field.textarea({ maxLength: 300, nullable: true }),
  primary: field.group({ fields: featureItem }),
  secondary: field.group({ fields: featureItem, nullable: true }),
  tertiary: field.group({ fields: featureItem, nullable: true }),
};

type FeaturesData = WidgetData<typeof featuresFields>;

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
  component: Features,
  defaultVariant: "grid",
  description:
    "Up to three features, told the same way in three different shapes.",
  fields: featuresFields,
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

export const featuresBlock = featuresWidget;
