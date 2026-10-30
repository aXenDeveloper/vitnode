import React from "react";

import { ActivityContentPanel } from "@/views/admin/views/content/actions/activity-action";
import { DeliveryContentPanel } from "@/views/admin/views/content/actions/delivery-action";
import { contentDeliveryRequestLocale } from "@/views/admin/views/content/actions/delivery-model";
import { HistoryContentPanel } from "@/views/admin/views/content/actions/history-action";
import { PreviewContentPanel } from "@/views/admin/views/content/actions/preview-action";
import { ScheduleContentPanel } from "@/views/admin/views/content/actions/schedule-action";

import type { ContentRowPanelProps } from "../slots";

import { RouteMessages } from "../../../i18n/route-messages";
import { useContentTypeForm } from "../form/spec";
import { ContentEditorialHost } from "./host";

const HistoryPanelBody = ({
  currentVersion,
  entry,
  finalFocus,
  itemId,
  onOpenChange,
  open,
  singular,
  title,
}: ContentRowPanelProps) => {
  const { spec } = useContentTypeForm(entry);

  return (
    <ContentEditorialHost>
      <HistoryContentPanel
        contentTypeId={entry.definition.id}
        currentVersion={currentVersion}
        finalFocus={finalFocus}
        id={itemId}
        onOpenChange={onOpenChange}
        open={open}
        permissionModule={entry.definition.permissionModule}
        pluginId={entry.pluginId}
        singular={singular}
        spec={spec}
        title={title}
      />
    </ContentEditorialHost>
  );
};

const HistoryPanel = (props: ContentRowPanelProps) => (
  <React.Suspense fallback={null}>
    <HistoryPanelBody {...props} />
  </React.Suspense>
);

const SchedulePanel = ({
  entry,
  finalFocus,
  itemId,
  onOpenChange,
  open,
  singular,
  title,
}: ContentRowPanelProps) => (
  <ContentEditorialHost>
    <ScheduleContentPanel
      contentTypeId={entry.definition.id}
      finalFocus={finalFocus}
      id={itemId}
      onOpenChange={onOpenChange}
      open={open}
      singular={singular}
      title={title}
    />
  </ContentEditorialHost>
);

const PreviewPanel = ({
  entry,
  finalFocus,
  itemId,
  onOpenChange,
  open,
  title,
}: ContentRowPanelProps) => (
  <ContentEditorialHost>
    <PreviewContentPanel
      contentTypeId={entry.definition.id}
      finalFocus={finalFocus}
      id={itemId}
      onOpenChange={onOpenChange}
      open={open}
      title={title}
    />
  </ContentEditorialHost>
);

const DeliveryPanel = ({
  entry,
  finalFocus,
  itemId,
  locale,
  onOpenChange,
  open,
  singular,
}: ContentRowPanelProps) => (
  <ContentEditorialHost>
    <DeliveryContentPanel
      contentTypeId={entry.definition.id}
      finalFocus={finalFocus}
      id={itemId}
      locale={contentDeliveryRequestLocale(entry.definition, locale)}
      onOpenChange={onOpenChange}
      open={open}
      singular={singular}
    />
  </ContentEditorialHost>
);

/**
 * The record's audit trail - for every content type, editorial or not. Its own
 * messages, because the content screen does not load the Activity Logs ones.
 */
const ActivityPanel = ({
  entry,
  finalFocus,
  itemId,
  onOpenChange,
  open,
  singular,
}: ContentRowPanelProps) => (
  <RouteMessages
    namespaces={[
      "core.activity_logs",
      "core.global",
      `${entry.pluginId}.content`,
    ]}
  >
    <ActivityContentPanel
      contentTypeId={entry.definition.id}
      finalFocus={finalFocus}
      id={itemId}
      onOpenChange={onOpenChange}
      open={open}
      pluginId={entry.pluginId}
      singular={singular}
    />
  </RouteMessages>
);

export const contentEditorialRowPanels = {
  activity: ActivityPanel,
  delivery: DeliveryPanel,
  history: HistoryPanel,
  preview: PreviewPanel,
  schedule: SchedulePanel,
};
