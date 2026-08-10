"use client";

import { PencilIcon } from "lucide-react";
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
import { Link } from "@/lib/navigation";

import type { ContentFormProps } from "./content-form";

const ContentForm = dynamic(async () =>
  import("./content-form").then(mod => ({ default: mod.ContentForm })),
);

// The locale editor carries the whole per-language surface - the tab strip, the
// panel, the history - so it is loaded with the dialog rather than with the table.
const LocaleEditor = dynamic(async () =>
  import("./translations/locale-editor").then(mod => ({
    default: mod.LocaleEditor,
  })),
);

/**
 * The edit row action.
 *
 * For a localized content type it opens the tabbed locale editor instead of the
 * plain form: `Shared` first, then one tab per language the app serves. The dialog
 * is reachable with `can_edit` **or** `can_translate` - a translator who may not
 * touch a shared field still needs somewhere to write the Polish copy, and each tab
 * gates its own actions.
 */
export const EditContentAction = ({
  defaultLocale,
  editorial = false,
  href,
  permissionModule,
  pluginId,
  singular,
  translationSpec = null,
  ...props
}: ContentFormProps & {
  /** The content type's default locale. Required when `translationSpec` is set. */
  defaultLocale?: string;
  editorial?: boolean;
  /** Set by `admin.edit.mode: "page"` - navigates instead of opening a dialog. */
  href?: string;
  permissionModule: string;
  pluginId: string;
  /** Localized-field form spec, or `null` when the content type is not localized. */
  translationSpec?: ContentFormSpec | null;
}) => {
  const t = useTranslations("core.content.edit");
  const canEdit = useAdminStaffPermission({
    module: permissionModule,
    permission: CONTENT_PERMISSIONS.edit,
    plugin: pluginId,
  });
  const canTranslate = useAdminStaffPermission({
    module: permissionModule,
    permission: CONTENT_PERMISSIONS.translate,
    plugin: pluginId,
  });

  const localized = translationSpec !== null && props.data !== undefined;

  if (!canEdit && !(localized && canTranslate)) return null;

  if (href) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label={t("title", { name: singular })}
                nativeButton={false}
                render={<Link href={href} />}
                size="icon"
                variant="ghost"
              >
                <PencilIcon className="size-4" />
              </Button>
            }
          />

          <TooltipContent>{t("title", { name: singular })}</TooltipContent>
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
              {localized ? (
                <LocaleEditor
                  defaultLocale={defaultLocale ?? ""}
                  editorial={editorial}
                  permissionModule={permissionModule}
                  pluginId={pluginId}
                  singular={singular}
                  translationSpec={translationSpec}
                  {...props}
                />
              ) : (
                <ContentForm singular={singular} {...props} />
              )}
            </React.Suspense>
          </DialogContent>
        </Dialog>

        <TooltipContent>{t("title", { name: singular })}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
