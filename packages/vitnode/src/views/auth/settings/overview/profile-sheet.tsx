import { PencilIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

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

import type { ProfileSheetFormProps } from "./profile-sheet-form";

const ProfileSheetForm = React.lazy(async () =>
  import("./profile-sheet-form").then(module => ({
    default: module.ProfileSheetForm,
  })),
);

const warm = () => {
  void import("./profile-sheet-form");
};

export const ProfileSheet = (props: Omit<ProfileSheetFormProps, "onDone">) => {
  const t = useTranslations("core.auth.settings.overview");
  const [open, setOpen] = React.useState(false);

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <SheetTrigger
        onFocus={warm}
        onPointerEnter={warm}
        render={<Button size="sm" variant="outline" />}
      >
        <PencilIcon />
        {t("editProfile")}
      </SheetTrigger>
      <SheetContent className="w-full gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
        <SheetHeader className="border-b pe-14">
          <SheetTitle>{t("editProfile")}</SheetTitle>
          <SheetDescription className="leading-relaxed text-pretty">
            {t("editProfileDesc")}
          </SheetDescription>
        </SheetHeader>
        <React.Suspense
          fallback={
            <div className="flex flex-1 items-center justify-center">
              <Spinner size="xl" />
            </div>
          }
        >
          <ProfileSheetForm
            {...props}
            onDone={() => {
              setOpen(false);
            }}
          />
        </React.Suspense>
      </SheetContent>
    </Sheet>
  );
};
