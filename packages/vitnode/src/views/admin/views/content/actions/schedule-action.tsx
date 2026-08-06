"use client";

import { CalendarClockIcon } from "lucide-react";
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

// The panel carries a form and the whole schedule list, so it loads with the
// dialog rather than with the table - the same treatment the edit form gets.
const SchedulePanel = dynamic(async () =>
  import("./schedule/schedule-panel").then(mod => ({
    default: mod.SchedulePanel,
  })),
);

/**
 * The scheduling row action.
 *
 * Gated by `can_publish`, not `can_edit`. Booking a publication *is*
 * publishing, just later - a role trusted to write drafts is not automatically
 * trusted to put one on the internet at 9am on Monday, and the route says the
 * same thing whether or not this button was rendered.
 */
export const ScheduleContentAction = ({
  contentTypeId,
  id,
  permissionModule,
  pluginId,
  singular,
  title,
}: {
  contentTypeId: string;
  id: number;
  permissionModule: string;
  pluginId: string;
  singular: string;
  title: string;
}) => {
  const t = useTranslations("core.content.schedule");
  const canPublish = useAdminStaffPermission({
    module: permissionModule,
    permission: CONTENT_PERMISSIONS.publish,
    plugin: pluginId,
  });

  if (!canPublish) return null;

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
                    <CalendarClockIcon className="size-4" />
                  </Button>
                }
              />
            }
          />

          <DialogContent>
            <DialogHeader>
              <DialogTitle>{label}</DialogTitle>
              <DialogDescription>{t("desc", { title })}</DialogDescription>
            </DialogHeader>

            <React.Suspense fallback={<Loader />}>
              <SchedulePanel
                contentTypeId={contentTypeId}
                id={id}
                singular={singular}
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
