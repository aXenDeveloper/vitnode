"use client";

import type { RegisteredFrontendContentType } from "@/content/index";
import type { ContentRowData } from "@/views/admin/views/content/table/cells";

import { ContentForm } from "@/views/admin/views/content/actions/content-form";

import { useContentTypeForm } from "./spec";

export const ContentDialogForm = ({
  entry,
  row,
  singular,
  title,
}: {
  entry: RegisteredFrontendContentType;
  row?: ContentRowData;
  singular: string;
  title?: string;
}) => {
  const { fieldOverrides, spec } = useContentTypeForm(entry);

  return (
    <ContentForm
      data={row}
      fieldOverrides={fieldOverrides}
      presentation="dialog"
      publication={entry.definition.publication.enabled}
      singular={singular}
      spec={spec}
      title={title}
    />
  );
};
