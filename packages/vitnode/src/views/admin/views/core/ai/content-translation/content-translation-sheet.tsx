import { useQueryClient } from "@tanstack/react-query";
import { LanguagesIcon } from "lucide-react";
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
import { FormFieldsPendingSkeleton } from "@/tanstack/pending/shapes";

import { adminContentTranslationQueryOptions } from "./content-translation-query";

const ContentTranslationForm = React.lazy(async () =>
  import("./content-translation-form").then(module => ({
    default: module.ContentTranslationForm,
  })),
);

/** AdminCP sheet for site-wide automatic translation of public content. */
export const ContentTranslationSheet = ({
  adminUserId,
}: {
  adminUserId: AdminIdentity;
}) => {
  const t = useTranslations("admin.ai.content_translation");
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);

  const warm = () => {
    void import("./content-translation-form");
    void queryClient
      .query(adminContentTranslationQueryOptions({ adminUserId }))
      .catch(() => undefined);
  };

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <SheetTrigger
        onFocus={warm}
        onPointerEnter={warm}
        render={<Button variant="outline" />}
      >
        <LanguagesIcon aria-hidden="true" />
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
          fallback={<FormFieldsPendingSkeleton footer="sheet" rows={5} />}
        >
          <ContentTranslationForm
            adminUserId={adminUserId}
            onSaved={() => {
              setOpen(false);
            }}
          />
        </React.Suspense>
      </SheetContent>
    </Sheet>
  );
};
