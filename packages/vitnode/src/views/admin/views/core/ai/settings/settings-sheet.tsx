import { useQueryClient } from "@tanstack/react-query";
import { Settings2Icon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";

import type { AiSettingsFormProps } from "./settings-form-content";

import { adminAiSettingsQueryOptions } from "../ai-query";

const AiSettingsSheetBody = React.lazy(async () =>
  import("./settings-sheet-body").then(module => ({
    default: module.AiSettingsSheetBody,
  })),
);

export const AiSettingsSheet = ({
  adminUserId,
  onOpenChange,
  onSave,
  open,
}: Pick<AiSettingsFormProps, "onSave"> & {
  adminUserId: AdminIdentity;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) => {
  const t = useTranslations("admin.ai.settings");
  const queryClient = useQueryClient();

  const warm = () => {
    void import("./settings-sheet-body");
    void queryClient
      .query(adminAiSettingsQueryOptions({ adminUserId }))
      .catch(() => undefined);
  };

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetTrigger
        onFocus={warm}
        onPointerEnter={warm}
        render={<Button variant="outline" />}
      >
        <Settings2Icon />
        {t("open")}
      </SheetTrigger>
      <SheetContent className="w-full gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        <SheetHeader className="border-b pe-14">
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription className="leading-relaxed text-pretty">
            {t("desc")}
          </SheetDescription>
        </SheetHeader>
        <React.Suspense
          fallback={
            <div className="flex flex-1 items-center justify-center">
              <Spinner size="xl" />
            </div>
          }
        >
          <AiSettingsSheetBody adminUserId={adminUserId} onSave={onSave} />
        </React.Suspense>
      </SheetContent>
    </Sheet>
  );
};
