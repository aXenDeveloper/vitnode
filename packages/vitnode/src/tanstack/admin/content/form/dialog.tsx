"use client";

import React from "react";
import { useTranslations } from "use-intl";

import { ContentFormDialog } from "@/views/admin/views/content/actions/form-dialog";

import type { ContentFormDialogProps } from "../slots";

import { ContentFormHost } from "./host";

/**
 * The create and edit forms, in a dialog, for a TanStack Start list.
 *
 * What `./index.ts` registers as the list's `FormDialog` slot. The list owns the
 * trigger - a labelled button on the heading, a tooltipped pencil on a row - and
 * hands it here as `children`; everything below that is the form's.
 *
 * The dialog chrome itself is `ContentFormDialog`, shared with the Next.js
 * AdminCP, so the heading, the description, the suspense fallback and the way
 * the trigger is wired are one implementation rather than two that have to stay
 * identical.
 *
 * ## Nothing is built until it opens
 *
 * `ContentFormHost` is *inside* the `form` element rather than around the
 * dialog, and the element itself is not rendered until `DialogContent` mounts.
 * So a list of fifty rows creates no transports, no navigations and no form
 * specs - it creates fifty React elements, which is what a `<div>` costs.
 */
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
      title={t("title", { name: singular })}
    >
      {children as React.ReactElement}
    </ContentFormDialog>
  );
};
