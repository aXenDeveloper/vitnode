"use client";

import { PencilIcon } from "lucide-react";
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

import type { ContentFormProps } from "./content-form";

const ContentForm = dynamic(async () =>
  import("./content-form").then(mod => ({ default: mod.ContentForm })),
);

export const EditContentAction = ({
  permissionModule,
  pluginId,
  singular,
  ...props
}: ContentFormProps & {
  permissionModule: string;
  pluginId: string;
}) => {
  const t = useTranslations("core.content.edit");
  const canEdit = useAdminStaffPermission({
    module: permissionModule,
    permission: CONTENT_PERMISSIONS.edit,
    plugin: pluginId,
  });

  if (!canEdit) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <Dialog>
          <TooltipTrigger
            render={
              <DialogTrigger
                render={
                  <Button
                    aria-label={t("title", { name: singular })}
                    size="icon"
                    variant="ghost"
                  >
                    <PencilIcon className="size-4" />
                  </Button>
                }
              />
            }
          />

          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("title", { name: singular })}</DialogTitle>
              <DialogDescription>
                {t("desc", { name: singular })}
              </DialogDescription>
            </DialogHeader>

            <React.Suspense fallback={<Loader />}>
              <ContentForm singular={singular} {...props} />
            </React.Suspense>
          </DialogContent>
        </Dialog>

        <TooltipContent>{t("title", { name: singular })}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
