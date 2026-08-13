"use client";

import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";

import type { ContentPanelProps } from "./content-panel";

import { ContentPanel } from "./content-panel";

// The panel carries a form and the whole schedule list, so it loads with the
// dialog rather than with the table - the same treatment the edit form gets.
const SchedulePanel = dynamic(async () =>
  import("./schedule/schedule-panel").then(mod => ({
    default: mod.SchedulePanel,
  })),
);

/**
 * The scheduling row action.
 *
 * Listed for `can_publish`, not `can_edit`. Booking a publication *is*
 * publishing, just later - a role trusted to write drafts is not automatically
 * trusted to put one on the internet at 9am on Monday, and the route says the
 * same thing whether or not this was ever offered.
 */
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
      // `t.rich`, because the message names the record with a `<title>` tag -
      // the same shape delete, publish and restore use. Passing a plain string
      // for a tag is a formatting error at render time, not a compile one.
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
