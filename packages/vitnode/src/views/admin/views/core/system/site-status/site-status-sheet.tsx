import React from "react";
import { useTranslations } from "use-intl";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { FormPendingSkeleton } from "@/tanstack/pending";

import type {
  SiteStatusFormMode,
  SiteStatusFormProps,
} from "./site-status-form-content";

const SiteStatusFormContent = React.lazy(async () =>
  import("./site-status-form-content").then(module => ({
    default: module.SiteStatusFormContent,
  })),
);

/** Warms the sheet's form, e.g. on hover of the button that opens it. */
export const preloadSiteStatusForm = () => {
  void import("./site-status-form-content");
};

export const SiteStatusSheet = ({
  mode,
  onOpenChange,
  ...props
}: Omit<SiteStatusFormProps, "mode" | "onSaved"> & {
  /** The open sheet's mode, or `null` when it is closed. */
  mode: null | SiteStatusFormMode;
  onOpenChange: (mode: null | SiteStatusFormMode) => void;
}) => {
  const t = useTranslations("admin.system.site_status.sheet");
  // Keeps the title and form while the sheet animates closed.
  const [shownMode, setShownMode] = React.useState<SiteStatusFormMode>(
    mode ?? "edit",
  );
  if (mode !== null && mode !== shownMode) setShownMode(mode);

  return (
    <Sheet
      onOpenChange={open => {
        if (!open) onOpenChange(null);
      }}
      open={mode !== null}
    >
      <SheetContent className="w-full gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        <SheetHeader className="border-b pe-14">
          <SheetTitle>{t(`${shownMode}.title`)}</SheetTitle>
          <SheetDescription className="leading-relaxed text-pretty">
            {t(`${shownMode}.desc`)}
          </SheetDescription>
        </SheetHeader>
        <React.Suspense
          fallback={
            <div className="p-4">
              <FormPendingSkeleton />
            </div>
          }
        >
          <SiteStatusFormContent
            {...props}
            mode={shownMode}
            onSaved={() => {
              onOpenChange(null);
            }}
          />
        </React.Suspense>
      </SheetContent>
    </Sheet>
  );
};
