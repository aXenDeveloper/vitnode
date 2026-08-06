"use client";

import { CheckIcon, CopyIcon, ExternalLinkIcon, EyeIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import React from "react";
import { toast } from "sonner";

import { DateFormat } from "@/components/date-format";
import { useAdminStaffPermission } from "@/components/staff-permission/provider";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CONTENT_PERMISSIONS } from "@/content/const";

import type { ContentPreviewLink } from "./mutation-api.server";

import { contentErrorKey } from "../lib/mutation-feedback";
import { createContentPreviewAction } from "./mutation-api.server";

/** How long the "copied" tick stays before the icon flips back. */
const COPIED_FEEDBACK_MS = 2000;

const CopyButton = ({ label, url }: { label: string; url: string }) => {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) return;

    const timer = setTimeout(() => {
      setCopied(false);
    }, COPIED_FEEDBACK_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [copied]);

  return (
    <Button
      aria-label={label}
      onClick={() => {
        void navigator.clipboard.writeText(url).then(() => {
          setCopied(true);
        });
      }}
      size="icon"
      type="button"
      variant="outline"
    >
      {copied ? (
        <CheckIcon className="size-4" />
      ) : (
        <CopyIcon className="size-4" />
      )}
    </Button>
  );
};

/**
 * The preview row action.
 *
 * Present only for a content type with `editorial.preview`, and absent rather
 * than disabled for anything else - a greyed-out button invites someone to
 * work out how to enable it, and this one cannot be enabled from the UI.
 *
 * The token is minted **when the popover opens**, never earlier. A table of 25
 * rows must not be 25 live bearer credentials for unpublished records sitting
 * in a browser, and most of them would never be used.
 */
export const PreviewContentAction = ({
  contentTypeId,
  id,
  permissionModule,
  pluginId,
  title,
}: {
  contentTypeId: string;
  id: number;
  permissionModule: string;
  pluginId: string;
  title: string;
}) => {
  const t = useTranslations("core.content.preview");
  const tErrors = useTranslations("core.global.errors");
  const tContentErrors = useTranslations("core.content.errors");
  const [preview, setPreview] = React.useState<ContentPreviewLink | null>(null);
  const [loading, setLoading] = React.useState(false);

  // Reading is enough: a preview shows exactly what the public route would, so
  // anyone allowed to open the record in the AdminCP may already see it.
  const canView = useAdminStaffPermission({
    module: permissionModule,
    permission: CONTENT_PERMISSIONS.view,
    plugin: pluginId,
  });

  if (!canView) return null;

  const label = t("title");

  return (
    <Popover
      onOpenChange={open => {
        if (!open) {
          // Dropped on close so the next open mints a fresh link rather than
          // showing one that may already have expired in the meantime.
          setPreview(null);

          return;
        }

        setLoading(true);
        void createContentPreviewAction(contentTypeId, id)
          .then(result => {
            if (result.preview) {
              setPreview(result.preview);

              return;
            }

            const errorKey = contentErrorKey(result.status);
            toast.error(tErrors("title"), {
              description: errorKey
                ? tContentErrors(errorKey)
                : tErrors("internal_server_error"),
            });
          })
          .finally(() => {
            setLoading(false);
          });
      }}
    >
      <PopoverTrigger
        render={
          <Button aria-label={label} size="icon" variant="ghost">
            <EyeIcon className="size-4" />
          </Button>
        }
      />

      <PopoverContent className="flex w-80 flex-col gap-3">
        <PopoverTitle>{label}</PopoverTitle>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {t("desc", { title })}
        </p>

        {loading || !preview ? (
          <p className="text-muted-foreground text-sm">{t("loading")}</p>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <input
                aria-label={t("link")}
                className="border-input bg-muted text-muted-foreground min-w-0 flex-1 rounded-md border px-2 py-1 text-xs"
                readOnly
                value={preview.url}
              />
              <CopyButton label={t("copy")} url={preview.url} />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted-foreground text-xs">
                {t.rich("expires", {
                  when: () => <DateFormat date={preview.expiresAt} />,
                })}
              </span>

              <Button
                render={
                  <a
                    href={preview.url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <ExternalLinkIcon className="size-4" />
                    {t("open")}
                  </a>
                }
                size="sm"
                variant="outline"
              />
            </div>

            <p className="text-muted-foreground text-xs leading-relaxed">
              {t("warning")}
            </p>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
};
