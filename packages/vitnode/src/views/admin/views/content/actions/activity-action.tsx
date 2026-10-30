import React from "react";
import { useTranslations } from "use-intl";

import type { ContentId } from "@/content/ids";

import type { ContentPanelProps } from "./content-panel";

import { ContentPanel } from "./content-panel";

const ActivityHistory = React.lazy(
  async () =>
    await import("@/views/activity-logs/activity-history").then(mod => ({
      default: mod.ActivityHistory,
    })),
);

/**
 * "Activity" on a content row: the record's entries from the central Activity
 * Logs - who created, edited, published or moderated it - without leaving the
 * list. Separate from "History", which shows what its content used to be.
 */
export const ActivityContentPanel = ({
  contentTypeId,
  id,
  pluginId,
  singular,
  ...panel
}: ContentPanelProps & {
  contentTypeId: string;
  id: ContentId;
  pluginId: string;
  singular: string;
}) => {
  const t = useTranslations("core.activity_logs.history");

  return (
    <ContentPanel
      className="sm:max-w-2xl"
      description={t("desc")}
      title={`${t("title")} · ${singular}`}
      {...panel}
    >
      <div className="max-h-[70vh] overflow-y-auto pe-1">
        <ActivityHistory
          pluginId={pluginId}
          targetId={id}
          targetType={contentTypeId}
        />
      </div>
    </ContentPanel>
  );
};
