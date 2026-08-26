"use client";

import { CheckIcon, LinkIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import React from "react";

import { DateFormat } from "@/components/date-format";
import { Badge } from "@/components/ui/badge";
import { Loader } from "@/components/ui/loader";

import type { ContentDeliveryPanelData } from "../delivery-api.server";

import { readContentDeliveryAction } from "../delivery-api.server";

export const DeliveryPanel = ({
  contentTypeId,
  id,
  locale,
}: {
  contentTypeId: string;
  id: number;
  locale?: string;
}) => {
  const t = useTranslations("core.content.delivery");
  const [state, setState] = React.useState<
    | { data: ContentDeliveryPanelData; status: "ready" }
    | { message: string; status: "error" }
    | { status: "loading" }
  >({ status: "loading" });

  React.useEffect(() => {
    let active = true;

    void readContentDeliveryAction(contentTypeId, id, locale).then(result => {
      if (!active) return;

      setState(
        result.data
          ? { data: result.data, status: "ready" }
          : { message: result.error ?? t("load_failed"), status: "error" },
      );
    });

    return () => {
      active = false;
    };
  }, [contentTypeId, id, locale, t]);

  if (state.status === "loading") return <Loader />;

  if (state.status === "error") {
    return (
      <p className="text-destructive text-sm leading-relaxed">
        {state.message}
      </p>
    );
  }

  const { canonicalPath, history, isPublic } = state.data;
  const historical = history.filter(entry => entry.retiredAt !== null);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">{t("canonical")}</h3>

        {canonicalPath === null ? (
          <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
            {t("no_canonical")}
          </p>
        ) : (
          <p className="flex items-center gap-2 text-sm">
            <LinkIcon aria-hidden className="text-muted-foreground size-4" />
            <code className="break-all">{canonicalPath}</code>
          </p>
        )}

        <Badge className="w-fit" variant={isPublic ? "default" : "secondary"}>
          {isPublic ? (
            <CheckIcon aria-hidden className="size-3" />
          ) : (
            <XIcon aria-hidden className="size-3" />
          )}
          {isPublic ? t("states.published") : t("states.not_published")}
        </Badge>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">{t("historical")}</h3>

        {historical.length === 0 ? (
          <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
            {t("no_history")}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {historical.map(entry => (
              <li
                className="flex flex-col gap-1 text-sm"
                key={`${entry.slug}-${entry.createdAt.toISOString()}`}
              >
                <span className="flex flex-wrap items-center gap-2">
                  <code className="break-all">{entry.path}</code>
                  <span aria-hidden className="text-muted-foreground">
                    →
                  </span>
                  <span className="text-muted-foreground">
                    {canonicalPath === null
                      ? t("redirect_inactive")
                      : t("redirect_active")}
                  </span>
                </span>

                {entry.retiredAt === null ? null : (
                  <span className="text-muted-foreground flex gap-1 text-xs">
                    {t("retired_at")}
                    <DateFormat date={entry.retiredAt} />
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        {historical.length > 0 && canonicalPath === null ? (
          <p className="text-muted-foreground text-xs leading-relaxed text-pretty">
            {t("inactive_note")}
          </p>
        ) : null}
      </section>
    </div>
  );
};
