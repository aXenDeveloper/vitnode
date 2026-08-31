"use client";

import React from "react";
import { useTranslations } from "use-intl";

import type { ContentFormSpec } from "@/content/admin/spec";

import type { ContentPanelProps } from "./content-panel";

import { ContentPanel } from "./content-panel";

/**
 * A history body carries the diff renderer and every revision it opens, so it is
 * loaded when the dialog is - the same treatment the edit form gets, and the
 * reason a 25-row table costs one chunk rather than 25 queries.
 *
 * `React.lazy` rather than `next/dynamic`: the two do the same thing here - the
 * panel already renders inside `ContentPanel`'s `Suspense` - and only one of
 * them resolves in a bundle that is not Next.js.
 */
const RevisionHistory = React.lazy(
  async () =>
    await import("./history/revision-history").then(mod => ({
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
