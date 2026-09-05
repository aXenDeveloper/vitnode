"use client";

import React from "react";
import { useTranslations } from "use-intl";

import { ContentFormDialog } from "@/views/admin/views/content/actions/form-dialog";
import {
  contentFieldSkeletonOverrides,
  ContentFormSkeleton,
  contentFormSkeletonShape,
} from "@/views/admin/views/content/form/skeleton";

import type { ContentFormDialogProps } from "../slots";

import { ContentFormHost } from "./host";

const ContentDialogForm = React.lazy(async () =>
  import("./form-body").then(module => ({
    default: module.ContentDialogForm,
  })),
);

export const ContentAdminFormDialog = ({
  action,
  children,
  entry,
  row,
  singular,
  title,
}: ContentFormDialogProps) => {
  const tCreate = useTranslations("core.content.create");
  const tEdit = useTranslations("core.content.edit");
  const t = action === "create" ? tCreate : tEdit;

  return (
    <ContentFormDialog
      description={t("desc", { name: singular })}
      form={
        <ContentFormHost>
          <ContentDialogForm
            entry={entry}
            row={row}
            singular={singular}
            title={title}
          />
        </ContentFormHost>
      }
      skeleton={
        <ContentFormHost>
          <ContentFormSkeleton
            contentTypeId={entry.definition.id}
            mode={action}
            pluginId={entry.pluginId}
            publication={entry.definition.publication.enabled}
            shape={contentFormSkeletonShape({
              definition: entry.definition,
              overrides: contentFieldSkeletonOverrides(
                entry.registration.fields,
              ),
            })}
            singular={singular}
            title={title}
          />
        </ContentFormHost>
      }
      title={t("title", { name: singular })}
    >
      {children as React.ReactElement}
    </ContentFormDialog>
  );
};
