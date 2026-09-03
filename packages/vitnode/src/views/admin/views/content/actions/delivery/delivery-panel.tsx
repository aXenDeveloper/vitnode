// No "use client": reached only from `delivery-action`, which is a client entry.
import { useQuery } from "@tanstack/react-query";
import { CheckIcon, LinkIcon, XIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { DateFormat } from "@/components/date-format";
import { Badge } from "@/components/ui/badge";
import { Loader } from "@/components/ui/loader";

import { contentDeliveryQueryOptions } from "../editorial-query";
import { useContentEditorialTransport } from "../editorial-transport";

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
  const transport = useContentEditorialTransport();
  const { data, isPending } = useQuery(
    contentDeliveryQueryOptions({
      contentTypeId,
      itemId: id,
      locale,
      readDelivery: transport.readDelivery,
    }),
  );

  if (isPending) return <Loader />;

  if (!data?.data) {
    return (
      <p className="text-destructive text-sm leading-relaxed">
        {data?.error !== undefined && data.error !== ""
          ? data.error
          : t("load_failed")}
      </p>
    );
  }

  const { canonicalPath, history, isPublic } = data.data;
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
