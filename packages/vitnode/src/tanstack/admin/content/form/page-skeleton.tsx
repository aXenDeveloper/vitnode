"use client";

import { useTranslations } from "use-intl";

import type { RegisteredFrontendContentType } from "@/content/index";
import type { ContentRouteLabels } from "@/views/admin/views/content/content-labels";

import { contentAdminHref } from "@/content/index";
import { resolveContentFormLayout } from "@/lib/plugin";
import {
  contentFieldSkeletonOverrides,
  ContentFormSkeleton,
  contentFormSkeletonShape,
} from "@/views/admin/views/content/form/skeleton";

export const ContentFormPageSkeleton = ({
  entry,
  formTitle,
  labels,
  mode,
}: {
  entry: RegisteredFrontendContentType;
  formTitle?: string;
  labels: ContentRouteLabels;
  mode: "create" | "edit";
}) => {
  const tPage = useTranslations("core.content.page");
  const tCreate = useTranslations("core.content.create");
  const tEdit = useTranslations("core.content.edit");
  const t = mode === "create" ? tCreate : tEdit;
  const { singular } = labels;

  return (
    <ContentFormSkeleton
      contentTypeId={entry.definition.id}
      header={{
        back: {
          href: contentAdminHref(entry.definition),
          label: tPage("back", { name: labels.plural }),
        },
        desc: mode === "create" ? t("desc", { name: singular }) : formTitle,
        title: t("title", { name: singular }),
      }}
      layout={resolveContentFormLayout(entry.registration.forms, mode)}
      mode={mode}
      pluginId={entry.pluginId}
      publication={entry.definition.publication.enabled}
      shape={contentFormSkeletonShape({
        definition: entry.definition,
        overrides: contentFieldSkeletonOverrides(entry.registration.fields),
      })}
      singular={singular}
      title={formTitle}
    />
  );
};
