import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import {
  ChevronDownIcon,
  CircleCheckIcon,
  GlobeIcon,
  LockIcon,
  TriangleAlertIcon,
} from "lucide-react";
import React from "react";
import { useLocale, useTranslations } from "use-intl";

import type { ContentAccessAudience } from "@/content/access/policy";
import type { ContentAccessEffectiveResponse } from "@/content/access/schemas";

import { roleOptionName } from "@/components/form/fields/roles";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { CONTENT_ACCESS_ACTIONS } from "@/content/access/const";
import { sameContentAccessAudience } from "@/content/access/policy";
import { zodContentAccessEffectiveResponse } from "@/content/access/schemas";
import { rawFetcher } from "@/tanstack/fetcher";
import { RouteMessages } from "@/tanstack/i18n/route-messages";

export interface ContentAccessEffectiveNoticeProps {
  /** The content type's admin module, `definition.permissionModule`. */
  permissionModule: string;
  pluginId: string;
  /** The scopes the record is filed in now, as the editor holds them. */
  scopeIds: readonly (number | string)[];
}

const fetchEffective = async ({
  permissionModule,
  pluginId,
  scopeIds,
}: ContentAccessEffectiveNoticeProps): Promise<ContentAccessEffectiveResponse | null> => {
  const response = await rawFetcher({
    body: { scopeIds },
    method: "post",
    module: `content/${permissionModule}`,
    path: "/access/effective",
    pluginId,
    prefixPath: "/admin",
  });
  if (!response.ok) return null;
  const parsed = zodContentAccessEffectiveResponse.safeParse(
    await response.json(),
  );

  return parsed.success ? parsed.data : null;
};

const Notice = (props: ContentAccessEffectiveNoticeProps) => {
  const t = useTranslations("core.access.admin");
  const locale = useLocale();
  const labelId = React.useId();
  const ids = [...new Set(props.scopeIds.map(String))].sort();
  const query = useQuery({
    placeholderData: keepPreviousData,
    queryFn: async () => await fetchEffective({ ...props, scopeIds: ids }),
    queryKey: [
      "vitnode",
      "admin",
      "access-effective",
      props.pluginId,
      props.permissionModule,
      ids,
    ],
    staleTime: 0,
  });

  if (query.isPending) {
    return (
      <div aria-busy="true" className="flex h-8 items-center">
        <span className="sr-only" role="status">
          {t("effective.loading")}
        </span>
        <Skeleton className="h-4 w-48" />
      </div>
    );
  }
  if (!query.data) return null;

  const { actions, missing, roles } = query.data;
  const audienceText = (audience: ContentAccessAudience): string => {
    switch (audience.mode) {
      case "everyone":
        return t("audience.everyone");
      case "members":
        return t("audience.members");
      case "roles": {
        if (audience.roleIds.length === 0) return t("audience.nobody");
        const names = audience.roleIds.map(id => {
          const role = roles.find(candidate => candidate.id === id);

          return role ? roleOptionName(role, locale) : t("deleted_role");
        });

        return t("audience.roles", { roles: names.join(", ") });
      }
    }
  };
  const rows = CONTENT_ACCESS_ACTIONS.map(action => {
    // One line per distinct audience: a reader has to be in every
    // one of them, whichever category set it.
    const audiences = actions[action].requirements
      .map(requirement => requirement.audience)
      .filter(
        (audience, index, all) =>
          all.findIndex(other => sameContentAccessAudience(other, audience)) ===
          index,
      );

    return { action, audiences };
  });
  const restricted = rows.some(row => row.audiences.length > 0);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground" id={labelId}>
          {t("notice.label")}
        </span>
        <Popover>
          <PopoverTrigger
            render={
              <Button
                aria-busy={query.isFetching}
                aria-describedby={labelId}
                className="aria-busy:opacity-60"
                size="sm"
                type="button"
                variant="outline"
              />
            }
          >
            {restricted ? (
              <LockIcon aria-hidden="true" />
            ) : (
              <GlobeIcon aria-hidden="true" />
            )}
            {restricted ? t("notice.restricted") : t("notice.public")}
            <ChevronDownIcon aria-hidden="true" />
          </PopoverTrigger>
          <PopoverContent
            align="start"
            aria-label={t("notice.title")}
            className="w-80"
          >
            <dl className="flex flex-col gap-1.5 text-sm">
              {rows.map(({ action, audiences }) => (
                <div className="flex items-start gap-2" key={action}>
                  {audiences.length === 0 ? (
                    <CircleCheckIcon
                      aria-hidden="true"
                      className="text-muted-foreground mt-0.5 size-4 shrink-0"
                    />
                  ) : (
                    <LockIcon
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0"
                    />
                  )}
                  <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3">
                    <dt className="font-medium">
                      {t(`actions.${action}.label`)}
                    </dt>
                    <dd
                      className={cn(
                        "leading-relaxed text-pretty",
                        audiences.length === 0 && "text-muted-foreground",
                      )}
                    >
                      {audiences.length === 0
                        ? t("effective.open")
                        : audiences.map(audienceText).join(t("notice.and"))}
                    </dd>
                  </div>
                </div>
              ))}
            </dl>
            {restricted ? (
              <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
                {t("notice.intersection")}
              </p>
            ) : null}
          </PopoverContent>
        </Popover>
      </div>
      {missing.length > 0 ? (
        <p
          className="bg-destructive/10 text-destructive flex items-start gap-2 rounded-md p-3 text-sm leading-relaxed text-pretty"
          role="alert"
        >
          <TriangleAlertIcon
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0"
          />
          {t("notice.missing")}
        </p>
      ) : null}
    </div>
  );
};

/**
 * Who may read, comment on and download from a record filed under several
 * scopes (an article in its categories), as the server computes it for the
 * scopes the editor holds right now: a reader has to meet every scope's rule.
 * Renders a Public / Restricted badge that opens the per-action breakdown, and
 * a warning when a selected scope no longer exists. Shown in an editor before
 * saving; the server decides again on every read.
 */
export const ContentAccessEffectiveNotice = (
  props: ContentAccessEffectiveNoticeProps,
) => (
  <RouteMessages namespaces={["core.access"]}>
    <Notice {...props} />
  </RouteMessages>
);
