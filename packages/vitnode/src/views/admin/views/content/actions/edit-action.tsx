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
import { Link } from "@/lib/navigation";

import type { ContentFormProps } from "./content-form";

const ContentForm = dynamic(async () =>
  import("./content-form").then(mod => ({ default: mod.ContentForm })),
);

export const EditContentAction = ({
  href,
  permissionModule,
  pluginId,
  singular,
  ...props
}: ContentFormProps & {
  href?: string;
  permissionModule: string;
  pluginId: string;
}) => {
  const t = useTranslations("core.content.edit");
  const label = useTranslations("core.content.actions")("edit");
  const canEdit = useAdminStaffPermission({
    module: permissionModule,
    permission: CONTENT_PERMISSIONS.edit,
    plugin: pluginId,
  });

  if (!canEdit) return null;

  if (href) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label={label}
                nativeButton={false}
                render={<Link href={href} />}
                size="icon"
                variant="ghost"
              >
                <PencilIcon className="size-4" />
              </Button>
            }
          />

          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <Dialog>
          <TooltipTrigger
            render={
              <DialogTrigger
                render={
                  <Button aria-label={label} size="icon" variant="ghost">
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

        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
