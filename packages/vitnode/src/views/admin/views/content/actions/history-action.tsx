"use client";

import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";

import type { ContentFormSpec } from "@/content/admin/spec";

import type { ContentPanelProps } from "./content-panel";

import { ContentPanel } from "./content-panel";

// A history body carries the diff renderer and every revision it opens, so it
// is loaded when the dialog is - the same treatment the edit form gets.
const RevisionHistory = dynamic(async () =>
  import("./history/revision-history").then(mod => ({
    default: mod.RevisionHistory,
  })),
);

/**
 * The revision-history row action, opened from the row's overflow menu.
 *
 * Listed for `can_view`, not `can_restore`: reading what changed is part of
 * seeing the record at all, and a role that can look but not roll back is a
 * reasonable one. The restore button inside checks `can_restore` itself, and the
 * menu that lists this one holds the `can_view` gate.
 */
export const HistoryContentPanel = ({
  contentTypeId,
  currentVersion,
  id,
  permissionModule,
  pluginId,
  singular,
  spec,
  title,
  ...panel
}: ContentPanelProps & {
  contentTypeId: string;
  currentVersion: number;
  id: number;
  permissionModule: string;
  pluginId: string;
  singular: string;
  spec: ContentFormSpec;
  title: string;
}) => {
  const t = useTranslations("core.content.history");

  return (
    <ContentPanel
      className="sm:max-w-2xl"
      description={t("desc")}
      title={t("title", { name: singular })}
      {...panel}
    >
      <RevisionHistory
        contentTypeId={contentTypeId}
        currentVersion={currentVersion}
        id={id}
        permissionModule={permissionModule}
        pluginId={pluginId}
        singular={singular}
        spec={spec}
        title={title}
      />
    </ContentPanel>
  );
};
