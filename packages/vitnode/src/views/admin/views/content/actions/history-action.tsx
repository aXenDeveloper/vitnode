"use client";

import { HistoryIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import React from "react";

import type { ContentFormSpec } from "@/content/admin/spec";

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

// A history body carries the diff renderer and every revision it opens, so it
// is loaded when the dialog is - the same treatment the edit form gets.
const RevisionHistory = dynamic(async () =>
  import("./history/revision-history").then(mod => ({
    default: mod.RevisionHistory,
  })),
);

/**
 * The revision-history row action.
 *
 * Gated by `can_view`, not `can_restore`: reading what changed is part of
 * seeing the record at all, and a role that can look but not roll back is a
 * reasonable one. The restore button inside checks `can_restore` itself.
 */
export const HistoryContentAction = ({
  contentTypeId,
  currentVersion,
  id,
  permissionModule,
  pluginId,
  singular,
  spec,
  title,
}: {
  contentTypeId: string;
  currentVersion: number;
  id: number;
  permissionModule: string;
  pluginId: string;
  singular: string;
  spec: ContentFormSpec;
  title: string;
}) => {
  const t = useTranslations("core.content.history");
  const canView = useAdminStaffPermission({
    module: permissionModule,
    permission: CONTENT_PERMISSIONS.view,
    plugin: pluginId,
  });

  if (!canView) return null;

  const label = t("title", { name: singular });

  return (
    <TooltipProvider>
      <Tooltip>
        <Dialog>
          <TooltipTrigger
            render={
              <DialogTrigger
                render={
                  <Button aria-label={label} size="icon" variant="ghost">
                    <HistoryIcon className="size-4" />
                  </Button>
                }
              />
            }
          />

          <DialogContent>
            <DialogHeader>
              <DialogTitle>{label}</DialogTitle>
              <DialogDescription>{t("desc")}</DialogDescription>
            </DialogHeader>

            <React.Suspense fallback={<Loader />}>
              <RevisionHistory
                contentTypeId={contentTypeId}
                currentVersion={currentVersion}
                id={id}
                permissionModule={permissionModule}
                pluginId={pluginId}
                singular={singular}
                spec={spec}
                title={title}
              />
            </React.Suspense>
          </DialogContent>
        </Dialog>

        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
