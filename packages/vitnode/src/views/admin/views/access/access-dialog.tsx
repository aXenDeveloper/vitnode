import React from "react";
import { useTranslations } from "use-intl";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { ContentAccessFormProps } from "./access-form";

import { ContentAccessMatrixSkeleton } from "./access-matrix-skeleton";

const ContentAccessFormContent = React.lazy(async () =>
  import("./access-form").then(module => ({
    default: module.ContentAccessFormContent,
  })),
);

/**
 * The access dialog of one scope. `scopeId` `null` keeps it closed while its
 * open state animates out.
 */
export const ContentAccessDialog = ({
  formKey,
  onOpenChange,
  open,
  scopeId,
  ...form
}: Omit<ContentAccessFormProps, "scopeId"> & {
  formKey: number;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  scopeId: null | string;
}) => {
  const t = useTranslations("core.access.admin");

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="flex flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="border-b px-4 pe-12 pt-6 pb-4 sm:px-6">
          <DialogTitle className="text-balance">{t("title")}</DialogTitle>
          <DialogDescription className="truncate">
            {form.scopeName}
          </DialogDescription>
        </DialogHeader>

        {scopeId === null ? null : (
          <React.Suspense fallback={<ContentAccessMatrixSkeleton />}>
            <ContentAccessFormContent
              key={formKey}
              scopeId={scopeId}
              {...form}
            />
          </React.Suspense>
        )}
      </DialogContent>
    </Dialog>
  );
};
