"use client";

import React from "react";

import { DeliveryContentPanel } from "@/views/admin/views/content/actions/delivery-action";
import { contentDeliveryRequestLocale } from "@/views/admin/views/content/actions/delivery-model";
import { HistoryContentPanel } from "@/views/admin/views/content/actions/history-action";
import { PreviewContentPanel } from "@/views/admin/views/content/actions/preview-action";
import { ScheduleContentPanel } from "@/views/admin/views/content/actions/schedule-action";

import type { ContentRowPanelProps } from "../slots";

import { useContentTypeForm } from "../form/spec";
import { ContentEditorialHost } from "./host";

/**
 * The four editorial panels, as the row menu's slots.
 *
 * Each is the *same component* the Next.js AdminCP renders - the dialog, the
 * timeline, the diff, the schedule form, the URL history - wrapped in the two
 * providers that tell it how to reach the API and how to refresh the screen.
 * Nothing about a panel was rewritten for this host, which is the point: a
 * restore behaves identically in both AdminCPs because it *is* the same code.
 *
 * ## Why each panel mounts its own host
 *
 * A panel is a dialog: one is open at a time, and it is mounted beside the menu
 * rather than inside it (a menu item unmounts the moment it is clicked, and a
 * dialog rendered inside one would go with it). Mounting the providers here
 * rather than around the list keeps the whole editorial feature out of the list
 * screen, so a content type with none of these enabled loads none of it.
 *
 * ## Which are offered is not decided here
 *
 * `row-actions-model.ts` decides, from the content type's features and the
 * administrator's permissions, and `registeredContentRowPanels` intersects that
 * with what this module registers. A content type with `delivery: { enabled:
 * false }` has no `Delivery` entry in its menu at all - absent, rather than an
 * entry that opens a panel with nothing in it.
 */

/**
 * The revision timeline.
 *
 * `spec` is what the diff renders field labels and enum values from. The Next.js
 * AdminCP builds it in a Server Component and passes it down; there is no server
 * component here, so it is built in the browser from the same definition and the
 * same warmed messages - see `../form/spec.ts`.
 */
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

/**
 * The boundary the spec read suspends against, if it ever does.
 *
 * `useContentTypeForm` reads the AdminCP's messages out of the query entry the
 * route's loader already warmed with the same namespaces, so on a content screen
 * it resolves without suspending. This is what keeps that from being load-bearing:
 * a panel is opened from a row *inside the table*, and a suspension with no
 * boundary of its own would blank the table rather than the dialog.
 *
 * `fallback={null}` because the fallback is a dialog that has not opened yet -
 * there is nothing to show a placeholder in.
 */
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

/**
 * The record's canonical address and the ones it used to answer to.
 *
 * `locale` is passed through `contentDeliveryRequestLocale`, which drops it for
 * a content type with no translations. The row menu hands over the language the
 * *list* is being read in, and for a localized content type that is also the
 * translation whose address should be described - but the two are different
 * concepts, and a content type with one address per record must not be asked
 * about a language at all.
 */
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

export const contentEditorialRowPanels = {
  delivery: DeliveryPanel,
  history: HistoryPanel,
  preview: PreviewPanel,
  schedule: SchedulePanel,
};
