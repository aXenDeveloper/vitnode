"use client";

import { LinkIcon } from "lucide-react";
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

// The panel fetches a record's whole URL history, so it is loaded when the dialog
// is - the same treatment the edit form and the revision history get, and the
// reason a 25-row table costs 25 buttons rather than 25 queries.
const DeliveryPanel = dynamic(async () =>
  import("./delivery/delivery-panel").then(mod => ({
    default: mod.DeliveryPanel,
  })),
);

/**
 * The delivery row action: canonical URL, publication state, historical URLs.
 *
 * Gated by `can_view`, and by nothing else. It reports what the slug mutations
 * already did, so the permission that allowed the mutation is the only one it
 * needs - a `can_manage_redirects` for a read-only screen would be a permission
 * every install has to configure for no decision it can make.
 */
export const DeliveryContentAction = ({
  contentTypeId,
  id,
  locale,
  permissionModule,
  pluginId,
  singular,
}: {
  contentTypeId: string;
  id: number;
  /** The language whose URLs to show, when the list is viewed in one. */
  locale?: string;
  permissionModule: string;
  pluginId: string;
  singular: string;
}) => {
  const t = useTranslations("core.content.delivery");
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
                    <LinkIcon className="size-4" />
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
              <DeliveryPanel
                contentTypeId={contentTypeId}
                id={id}
                locale={locale}
              />
            </React.Suspense>
          </DialogContent>
        </Dialog>

        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
