"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";

import type { ContentPanelProps } from "./content-panel";

import { contentErrorKey } from "../lib/mutation-feedback";
import { deleteContentAction } from "./mutation-api.server";

/**
 * The delete row action, opened from the last item in the row's overflow menu.
 *
 * Behind the ⋯ button rather than beside Edit, and last in the list with a rule
 * above it: it is the one action in the cell that cannot be undone, and a
 * destructive button one pixel from the one people click all day is how a record
 * goes missing. The confirmation is unchanged - it still names the record, and it
 * still refuses to guess about a version it has not shown anybody.
 *
 * Listed for `can_delete`, and the route answers 403 whether or not it was.
 */
export const DeleteContentPanel = ({
  contentTypeId,
  finalFocus,
  id,
  singular,
  title,
  version,
  ...panel
}: ContentPanelProps & {
  contentTypeId: string;
  id: number;
  singular: string;
  title: string;
  /**
   * The version this row showed. `undefined` for a content type without
   * `editorial`, whose delete has no precondition and never had one.
   */
  version?: number;
}) => {
  const t = useTranslations("core.content.delete");
  const tErrors = useTranslations("core.global.errors");
  const tContentErrors = useTranslations("core.content.errors");

  return (
    <ConfirmActionAlertDialog
      description={t.rich("desc", {
        title: () => <span className="text-foreground font-bold">{title}</span>,
      })}
      finalFocus={finalFocus}
      onSubmit={async ({ onClose }) => {
        const mutation = await deleteContentAction(contentTypeId, id, version);

        if (mutation.error !== undefined) {
          // Someone saved while this dialog was open. Deliberately *not* retried
          // with the new version: the whole point of the precondition is that the
          // person confirms deleting the record as it is now, and they have not
          // seen what changed.
          if (mutation.conflict?.code === "CONTENT_VERSION_CONFLICT") {
            toast.error(t("conflict.title"), {
              description: t("conflict.desc"),
            });

            return;
          }

          // A restricted delete (409) is a normal, explainable outcome; an
          // unrecognised status is a server fault and reads as one.
          const errorKey = contentErrorKey(mutation.status);

          toast.error(tErrors("title"), {
            description: errorKey
              ? tContentErrors(errorKey)
              : tErrors("internal_server_error"),
          });

          return;
        }

        toast.success(t("success", { name: singular }), { description: title });
        onClose();
      }}
      textSubmit={t("confirm")}
      title={t("title", { name: singular })}
      {...panel}
    />
  );
};
