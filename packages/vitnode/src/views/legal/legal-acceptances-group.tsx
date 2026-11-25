import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import { RotateCwIcon, ScrollTextIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

import { SETTINGS_ROW, SettingsGroup } from "../auth/settings/settings-group";
import { useLegalDate } from "./legal-format";
import { legalAcceptancesQueryOptions } from "./legal-query";

/**
 * The member's own Terms of Service acceptances on Settings → Privacy & data:
 * version, time, language and how they accepted. The same records are part
 * of the personal-data download.
 */
export const LegalAcceptancesGroup = ({ userId }: { userId: number }) => {
  const t = useTranslations("core.legal.settings");
  const tLegal = useTranslations("core.legal");
  const formatDate = useLegalDate();
  const query = useQuery(legalAcceptancesQueryOptions(userId));

  return (
    <SettingsGroup
      footer={
        <p className="text-muted-foreground text-sm leading-relaxed">
          {t("desc")}
        </p>
      }
      title={
        <>
          <ScrollTextIcon aria-hidden="true" className="size-4" />
          {t("title")}
        </>
      }
    >
      {query.isPending ? (
        <li
          aria-busy="true"
          className={cn(SETTINGS_ROW, "flex-col items-start")}
        >
          <span className="sr-only" role="status">
            {t("title")}
          </span>
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-56" />
        </li>
      ) : query.isError ? (
        <li className="p-4">
          <Empty role="alert">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ScrollTextIcon aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>{t("load_error.title")}</EmptyTitle>
              <EmptyDescription>{t("load_error.desc")}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                isLoading={query.isFetching}
                onClick={() => void query.refetch()}
                variant="outline"
              >
                <RotateCwIcon aria-hidden="true" />
                {tLegal("retry")}
              </Button>
            </EmptyContent>
          </Empty>
        </li>
      ) : query.data.items.length === 0 ? (
        <li className={cn(SETTINGS_ROW, "text-muted-foreground text-sm")}>
          {t("empty")}
        </li>
      ) : (
        query.data.items.map(item => (
          <li
            className={cn(SETTINGS_ROW, "flex-col items-start gap-1")}
            key={item.id}
          >
            <Link
              className="font-medium underline-offset-4 hover:underline"
              to={`/terms/versions/${item.version}`}
            >
              {tLegal(`types.${item.documentType}`)} ·{" "}
              {tLegal("version", { version: item.version })}
            </Link>
            <p className="text-muted-foreground text-sm leading-relaxed">
              <time dateTime={item.acceptedAt}>
                {t("accepted_at", { date: formatDate(item.acceptedAt) })}
              </time>
              {" · "}
              {t(`via.${item.source}`)}
              {" · "}
              {t("language", { locale: item.locale })}
            </p>
          </li>
        ))
      )}
    </SettingsGroup>
  );
};
