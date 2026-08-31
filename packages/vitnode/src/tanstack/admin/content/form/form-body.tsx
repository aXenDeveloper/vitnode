"use client";

import type { RegisteredFrontendContentType } from "@/content/index";
import type { ContentRowData } from "@/views/admin/views/content/table/cells";

import { ContentForm } from "@/views/admin/views/content/actions/content-form";

import { useContentTypeForm } from "./spec";

/**
 * A dialog-mode content form, once the dialog has actually been opened.
 *
 * Behind `React.lazy` and inside `DialogContent`, which is what makes the two
 * expensive things here free until somebody clicks: the AutoForm stack with
 * every field component it can render, and the spec build - one per content type
 * per language, which a list of fifty rows would otherwise do fifty times for
 * dialogs nobody opened.
 *
 * ## No custom layout, deliberately
 *
 * `forms.layout` is resolved for the **page** screens only - in `./page-body`,
 * which is the other half of this split. A dialog passes none.
 * A plugin layout is a full editor screen - `@vitnode/blog`'s article form is a
 * two-column arrangement with its own sidebar - and rendering one inside a
 * dialog was never what it was written for. A content type that wants its layout
 * declares `admin.edit.mode: "page"`, which is the switch that decides this.
 *
 * ## The row is handed straight to the form
 *
 * Including its missing collection fields. A list row deliberately does not
 * carry a repeatable, a to-many reference or a gallery - those live on tables of
 * their own and would cost queries per page for values no column renders - and
 * `ContentForm` detects that and reloads the record's detail before it opens.
 * See `missingCollections` there: a form that opened on empty sets would save
 * them that way.
 */
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
