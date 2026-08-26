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
