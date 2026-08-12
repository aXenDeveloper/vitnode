"use client";

import { LanguagesIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import React from "react";

import { useAdminStaffPermission } from "@/components/staff-permission/provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader } from "@/components/ui/loader";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CONTENT_PERMISSIONS } from "@/content/const";

// The per-language lifecycle panel pulls in the history reader, so it arrives
// with the dialog rather than with the table.
const TranslationManager = dynamic(async () =>
  import("./translations/translation-manager").then(mod => ({
    default: mod.TranslationManager,
  })),
);

/**
 * The per-language lifecycle action.
 *
 * Translation *values* are edited in the ordinary form, where each localized
 * input has its own language switcher - so this is not an editor. It is where
 * the things that are genuinely about one language and not about one field live:
 * publish, unpublish, history, restore and delete.
 *
 * A dialog rather than a strip of tabs around the form, deliberately: the
 * language is a parameter of *this* action, not a mode the whole screen is in.
 */
export const TranslationsContentAction = ({
  contentTypeId,
  defaultLocale,
  editorial,
  id,
  permissionModule,
  pluginId,
  publication,
  singular,
  title,
}: {
  contentTypeId: string;
  defaultLocale: string;
  editorial: boolean;
  id: number;
  permissionModule: string;
  pluginId: string;
  publication: boolean;
  singular: string;
  title: string;
}) => {
  const t = useTranslations("core.content.translations");
  const canView = useAdminStaffPermission({
    module: permissionModule,
    permission: CONTENT_PERMISSIONS.view,
    plugin: pluginId,
  });

  if (!canView) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <Dialog>
          <TooltipTrigger
            render={
              <DialogTrigger
                render={
                  <Button
                    aria-label={t("manage", { name: singular })}
                    size="icon"
                    variant="ghost"
                  >
                    <LanguagesIcon className="size-4" />
                  </Button>
                }
              />
            }
          />

          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("manage", { name: singular })}</DialogTitle>
              <DialogDescription>{title}</DialogDescription>
            </DialogHeader>

            <React.Suspense fallback={<Loader />}>
              <TranslationManager
                contentTypeId={contentTypeId}
                defaultLocale={defaultLocale}
                editorial={editorial}
                itemId={id}
                permissionModule={permissionModule}
                pluginId={pluginId}
                publication={publication}
              />
            </React.Suspense>
          </DialogContent>
        </Dialog>

        <TooltipContent>{t("manage", { name: singular })}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
