"use client";

import { CheckIcon, CopyIcon, ExternalLinkIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import React from "react";
import { toast } from "sonner";

import { DateFormat } from "@/components/date-format";
import { Button } from "@/components/ui/button";

import type { ContentPanelProps } from "./content-panel";
import type { ContentPreviewLink } from "./mutation-api.server";

import { contentErrorKey } from "../lib/mutation-feedback";
import { ContentPanel } from "./content-panel";
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
 * The link itself, minted on mount.
 *
 * A body rather than state on the panel, because the dialog unmounts this when it
 * closes: one opening is one token, and a link left over from the last time the
 * panel was open may already have expired.
 */
const PreviewLink = ({
  contentTypeId,
  id,
}: {
  contentTypeId: string;
  id: number;
}) => {
  const t = useTranslations("core.content.preview");
  const tErrors = useTranslations("core.global.errors");
  const tContentErrors = useTranslations("core.content.errors");
  const [preview, setPreview] = React.useState<ContentPreviewLink | null>(null);

  React.useEffect(() => {
    // A link that arrives after the dialog was closed again is thrown away rather
    // than written into a component nobody is looking at.
    let current = true;

    void createContentPreviewAction(contentTypeId, id).then(result => {
      if (!current) return;

      if (result.preview) {
        setPreview(result.preview);

        return;
      }

      // 503 is the one failure with a fix the person reading it can apply, so it
      // says what to do rather than "something went wrong".
      if (result.status === 503) {
        toast.error(tErrors("title"), { description: t("unavailable") });

        return;
      }

      const errorKey = contentErrorKey(result.status);
      toast.error(tErrors("title"), {
        description: errorKey
          ? tContentErrors(errorKey)
          : tErrors("internal_server_error"),
      });
    });

    return () => {
      current = false;
    };
  }, [contentTypeId, id, t, tContentErrors, tErrors]);

  // A failure leaves this line in place and puts the reason in a toast: there is
  // nothing to show, and an empty panel says less than "creating a link".
  if (!preview) {
    return <p className="text-muted-foreground text-sm">{t("loading")}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
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
          nativeButton={false}
          render={
            <a href={preview.url} rel="noopener noreferrer" target="_blank">
              <ExternalLinkIcon className="size-4" />
              {t("open")}
            </a>
          }
          size="sm"
          variant="outline"
        />
      </div>

      {/* `0` means the record predates its content type opting into editorial, so
          there is no snapshot to freeze and the link reads the live row. Worth
          saying out loud - "preview" otherwise promises something this one link
          cannot deliver. */}
      {preview.revisionId === 0 ? (
        <p className="text-muted-foreground text-xs leading-relaxed">
          {t("live")}
        </p>
      ) : null}

      <p className="text-muted-foreground text-xs leading-relaxed">
        {t("warning")}
      </p>
    </div>
  );
};

/**
 * The preview row action.
 *
 * Listed only for a content type with `editorial.preview`, and absent rather than
 * disabled for anything else - a greyed-out entry invites someone to work out how
 * to enable it, and this one cannot be enabled from the UI.
 *
 * The token is minted **when the panel opens**, never earlier. A table of 25 rows
 * must not be 25 live bearer credentials for unpublished records sitting in a
 * browser, and most of them would never be used.
 */
export const PreviewContentPanel = ({
  contentTypeId,
  id,
  title,
  ...panel
}: ContentPanelProps & {
  contentTypeId: string;
  id: number;
  title: string;
}) => {
  const t = useTranslations("core.content.preview");

  return (
    <ContentPanel
      description={t("desc", { title })}
      title={t("title")}
      {...panel}
    >
      {/* Mounted by the dialog, and only while it is open - which is what makes
          "one opening, one token" true. */}
      <PreviewLink contentTypeId={contentTypeId} id={id} />
    </ContentPanel>
  );
};
