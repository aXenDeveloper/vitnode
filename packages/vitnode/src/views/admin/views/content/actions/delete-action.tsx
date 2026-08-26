"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";

import type { ContentPanelProps } from "./content-panel";

import { contentErrorKey } from "../lib/mutation-feedback";
import { useInvalidateContentOptions } from "../lib/options-query";
import { deleteContentAction } from "./mutation-api.server";

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
  version?: number;
}) => {
  const t = useTranslations("core.content.delete");
  const tErrors = useTranslations("core.global.errors");
  const tContentErrors = useTranslations("core.content.errors");
  const invalidateOptions = useInvalidateContentOptions();

  return (
    <ConfirmActionAlertDialog
      description={t.rich("desc", {
        title: () => <span className="text-foreground font-bold">{title}</span>,
      })}
      finalFocus={finalFocus}
      onSubmit={async ({ onClose }) => {
        const mutation = await deleteContentAction(contentTypeId, id, version);

        if (mutation.error !== undefined) {
          if (mutation.conflict?.code === "CONTENT_VERSION_CONFLICT") {
            toast.error(t("conflict.title"), {
              description: t("conflict.desc"),
            });

            return;
          }

          const errorKey = contentErrorKey(mutation.status);

          toast.error(tErrors("title"), {
            description: errorKey
              ? tContentErrors(errorKey)
              : tErrors("internal_server_error"),
          });

          return;
        }

        invalidateOptions(contentTypeId);

        toast.success(t("success", { name: singular }), { description: title });
        onClose();
      }}
      textSubmit={t("confirm")}
      title={t("title", { name: singular })}
      {...panel}
    />
  );
};
