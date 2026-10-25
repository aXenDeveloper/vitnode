import type { WidgetComponentProps, WidgetData } from "@vitnode/core/widgets";

import { field } from "@vitnode/core/content/fields";
import { defineWidget } from "@vitnode/core/widgets";
import { InfoIcon } from "lucide-react";

const calloutFields = {
  body: field.textarea({ maxLength: 600, minLength: 1, required: true }),
  title: field.text({ maxLength: 120, minLength: 1, required: true }),
  tone: field.enum({
    defaultValue: "info",
    values: ["info", "success", "warning"],
  }),
};

type CalloutData = WidgetData<typeof calloutFields>;

const tones: Record<string, string> = {
  info: "border-primary/40 bg-primary/5",
  success: "border-success/40 bg-success/5",
  warning: "border-destructive/40 bg-destructive/5",
};

const Callout = ({ data }: WidgetComponentProps<CalloutData>) => (
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

export const calloutWidget = defineWidget({
  component: Callout,
  description: "A short highlighted note in one of three tones.",
  fields: calloutFields,
  icon: InfoIcon,
  id: "callout",
  name: "Callout",
});

export const calloutBlock = calloutWidget;
