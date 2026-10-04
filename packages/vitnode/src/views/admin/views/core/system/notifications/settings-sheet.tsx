import { Settings2Icon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

import type { NotificationsSettingsSheetBodyProps } from "./settings-sheet-content";

const NotificationsSettingsSheetBody = React.lazy(async () =>
  import("./settings-sheet-content").then(module => ({
    default: module.NotificationsSettingsSheetBody,
  })),
);

const SheetBodySkeleton = () => (
  <div aria-hidden className="flex flex-col gap-6 px-4 py-5">
    {["h-48", "h-44", "h-24", "h-60"].map(height => (
      <div className="flex flex-col gap-2" key={height}>
        <Skeleton className="h-3 w-24" />
        <Skeleton className={`w-full rounded-xl ${height}`} />
      </div>
    ))}
  </div>
);

export const NotificationsSettingsSheet = (
  props: NotificationsSettingsSheetBodyProps,
) => {
  const t = useTranslations("admin.system.notifications.settings");
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button
        onClick={() => {
          setOpen(true);
        }}
        variant="outline"
      >
        <Settings2Icon aria-hidden />
        {t("button")}
      </Button>
      <Sheet onOpenChange={setOpen} open={open}>
        <SheetContent className="w-full gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
          <SheetHeader className="border-b">
            <SheetTitle>{t("title")}</SheetTitle>
            <SheetDescription>
              {props.canEdit ? t("desc") : t("read_only")}
            </SheetDescription>
          </SheetHeader>
          <div className="bg-muted/30 flex-1 overflow-y-auto">
            <React.Suspense fallback={<SheetBodySkeleton />}>
              <NotificationsSettingsSheetBody {...props} />
            </React.Suspense>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
