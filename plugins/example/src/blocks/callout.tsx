import type { BlockComponentProps, BlockData } from "@vitnode/core/blocks";

import { defineBlock } from "@vitnode/core/blocks";
import { field } from "@vitnode/core/content/fields";

const calloutFields = {
  body: field.textarea({ maxLength: 600, minLength: 1, required: true }),
  title: field.text({ maxLength: 120, minLength: 1, required: true }),
  tone: field.enum({
    defaultValue: "info",
    values: ["info", "success", "warning"],
  }),
};

type CalloutData = BlockData<typeof calloutFields>;

const tones: Record<string, string> = {
  info: "border-primary/40 bg-primary/5",
  success: "border-success/40 bg-success/5",
  warning: "border-destructive/40 bg-destructive/5",
};

const Callout = ({ data }: BlockComponentProps<CalloutData>) => (
  <aside
    className={`flex flex-col gap-2 rounded-lg border p-4 md:p-6 ${tones[data.tone ?? "info"]}`}
  >
    <h2 className="text-base font-semibold text-balance md:text-lg">
      {data.title}
    </h2>
    <p className="text-sm leading-relaxed text-pretty md:text-base">
      {data.body}
    </p>
  </aside>
);

export const calloutBlock = defineBlock({
  component: Callout,
  description: "A short highlighted note in one of three tones.",
  fields: calloutFields,
  id: "callout",
  name: "Callout",
});
