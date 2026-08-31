"use client";

import React from "react";
import { useTranslations } from "use-intl";

import type { ContentPanelProps } from "./content-panel";

import { ContentPanel } from "./content-panel";

// The panel carries a form and the whole schedule list, so it loads with the
// dialog rather than with the table - the same treatment the edit form gets.
const SchedulePanel = React.lazy(
  async () =>
    await import("./schedule/schedule-panel").then(mod => ({
      default: mod.SchedulePanel,
    })),
);

export const ScheduleContentPanel = ({
  contentTypeId,
  id,
  singular,
  title,
  ...panel
}: ContentPanelProps & {
  contentTypeId: string;
  id: number;
  singular: string;
  title: string;
}) => {
  const t = useTranslations("core.content.schedule");

  return (
    <ContentPanel
      description={t.rich("desc", {
        title: () => <span className="text-foreground font-bold">{title}</span>,
      })}
      title={t("title", { name: singular })}
      {...panel}
    >
      <SchedulePanel
        contentTypeId={contentTypeId}
        id={id}
        singular={singular}
        title={title}
      />
    </ContentPanel>
  );
};
