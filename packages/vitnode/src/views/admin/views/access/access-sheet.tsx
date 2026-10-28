import React from "react";
import { useTranslations } from "use-intl";

import { Dialog } from "@/components/ui/dialog";
import {
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";

import type { ContentAccessFormProps } from "./access-form";

const ContentAccessFormContent = React.lazy(async () =>
  import("./access-form").then(module => ({
    default: module.ContentAccessFormContent,
  })),
);

/**
 * The access sheet of one scope. `scopeId` `null` keeps it closed while its
 * open state animates out.
 */
export const ContentAccessSheet = ({
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
      <SheetContent
        className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
        side="right"
      >
        <SheetHeader className="border-b pe-12">
          <SheetTitle className="text-balance">{t("title")}</SheetTitle>
          <SheetDescription className="truncate">{form.scopeName}</SheetDescription>
        </SheetHeader>

        {scopeId === null ? null : (
          <React.Suspense
            fallback={
              <div className="flex flex-1 items-center justify-center p-6">
                <Spinner size="xl" />
              </div>
            }
          >
            <ContentAccessFormContent key={formKey} scopeId={scopeId} {...form} />
          </React.Suspense>
        )}
      </SheetContent>
    </Dialog>
  );
};
