"use client";

import { PencilIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { useAdminStaffPermission } from "@/components/staff-permission/provider";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CONTENT_PERMISSIONS } from "@/content/const";

import type { ContentFormProps } from "./content-form";

import { useContentFormNavigation } from "../form/navigation";
import { ContentFormDialog } from "./form-dialog";
import { ContentLinkButton } from "./link-button";

/** Lazily, for the reason `create-action` gives at length. */
const ContentForm = React.lazy(async () =>
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
  const { LinkComponent } = useContentFormNavigation();
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
              <ContentLinkButton
                aria-label={label}
                href={href}
                LinkComponent={LinkComponent}
                size="icon"
                variant="ghost"
              >
                <PencilIcon className="size-4" />
              </ContentLinkButton>
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
        <ContentFormDialog
          description={t("desc", { name: singular })}
          form={<ContentForm singular={singular} {...props} />}
          title={t("title", { name: singular })}
        >
          <TooltipTrigger
            render={
              <Button aria-label={label} size="icon" variant="ghost">
                <PencilIcon className="size-4" />
              </Button>
            }
          />
        </ContentFormDialog>

        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
