"use client";

import { PlusIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import type { RegisteredFrontendContentType } from "@/content/index";
import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { Button } from "@/components/ui/button";
import { CONTENT_PERMISSIONS, contentCreateHref } from "@/content/index";

import { RouterLink } from "../../layout/router-link";
import { useAdminPermission } from "../permissions";
import { ContentFormDialogSlot } from "./slot-render";
import { contentAdminSlots } from "./slots";

export const ContentCreateAction = ({
  entry,
  LinkComponent = RouterLink,
  singular,
}: {
  entry: RegisteredFrontendContentType;
  /** How a path becomes a navigation. See {@link RouterLink} for the default. */
  LinkComponent?: AuthLinkComponent;
  singular: string;
}) => {
  const { definition, pluginId } = entry;
  const t = useTranslations("core.content.create");
  const canCreate = useAdminPermission({
    module: definition.permissionModule,
    permission: CONTENT_PERMISSIONS.create,
    plugin: pluginId,
  });
  const formDialog = contentAdminSlots().FormDialog;

  if (!canCreate) return null;

  const label = t("title", { name: singular });

  if (definition.admin.create.mode === "page") {
    return (
      <Button
        nativeButton={false}
        render={<LinkComponent href={contentCreateHref(definition)} />}
      >
        <PlusIcon />
        {label}
      </Button>
    );
  }

  if (!formDialog) return null;

  return (
    <ContentFormDialogSlot
      action="create"
      dialog={formDialog}
      entry={entry}
      singular={singular}
    >
      <Button>
        <PlusIcon />
        {label}
      </Button>
    </ContentFormDialogSlot>
  );
};
