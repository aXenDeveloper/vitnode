"use client";

import { CheckIcon, CopyIcon, ExternalLinkIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { DateFormat } from "@/components/date-format";
import { Button } from "@/components/ui/button";

import type { ContentPanelProps } from "./content-panel";
import type { ContentPreviewLink } from "./editorial-api";

import { contentErrorKey } from "../lib/mutation-feedback";
import { ContentPanel } from "./content-panel";
import { useContentEditorialTransport } from "./editorial-transport";

/**
 * A signed link to the current draft, minted on the click and not before.
 *
 * Deliberately **not** a cached query. A preview URL carries a short-lived
 * bearer token for an unpublished record, so it is minted when the dialog opens
 * and forgotten when it closes - caching one would leave a live credential in
 * the browser for every row somebody glanced at, and serving a stale one back
 * would hand out a token that has already expired.
 */

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
  const transport = useContentEditorialTransport();
  const [preview, setPreview] = React.useState<ContentPreviewLink | null>(null);

  React.useEffect(() => {
    let current = true;

    void transport.createPreview(contentTypeId, id).then(result => {
      if (!current) return;

      if (result.preview) {
        setPreview(result.preview);

        return;
      }

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
  }, [contentTypeId, id, t, tContentErrors, tErrors, transport]);

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
      <PreviewLink contentTypeId={contentTypeId} id={id} />
    </ContentPanel>
  );
};
