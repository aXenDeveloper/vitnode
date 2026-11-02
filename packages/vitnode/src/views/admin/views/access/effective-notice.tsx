import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CircleCheckIcon, LockIcon, TriangleAlertIcon } from "lucide-react";
import { useLocale, useTranslations } from "use-intl";

import type { ContentAccessAudience } from "@/content/access/policy";
import type { ContentAccessEffectiveResponse } from "@/content/access/schemas";

import { roleOptionName } from "@/components/form/fields/roles";
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
      <div
        aria-busy="true"
        className="flex flex-col gap-2 rounded-lg border p-4"
      >
        <span className="sr-only" role="status">
          {t("effective.loading")}
        </span>
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
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
  const restricted = CONTENT_ACCESS_ACTIONS.some(
    action => actions[action].requirements.length > 0,
  );

  return (
    <section
      aria-busy={query.isFetching}
      aria-labelledby="content-access-notice"
      className="flex flex-col gap-3 rounded-lg border p-4 aria-busy:opacity-60"
    >
      <h3
        className="flex items-center gap-2 text-sm font-semibold text-balance"
        id="content-access-notice"
      >
        {restricted ? (
          <LockIcon aria-hidden="true" className="size-4" />
        ) : (
          <CircleCheckIcon aria-hidden="true" className="size-4" />
        )}
        {t("notice.title")}
      </h3>
      {restricted ? (
        <>
          <dl className="flex flex-col gap-2 text-sm">
            {CONTENT_ACCESS_ACTIONS.map(action => {
              // One line per distinct audience: a reader has to be in every
              // one of them, whichever category set it.
              const audiences = actions[action].requirements
                .map(requirement => requirement.audience)
                .filter(
                  (audience, index, all) =>
                    all.findIndex(other =>
                      sameContentAccessAudience(other, audience),
                    ) === index,
                );

              return (
                <div className="flex flex-col gap-0.5" key={action}>
                  <dt className="font-medium">
                    {t(`actions.${action}.label`)}
                  </dt>
                  <dd className="text-muted-foreground leading-relaxed text-pretty">
                    {audiences.length === 0
                      ? t("effective.open")
                      : audiences.map(audienceText).join(t("notice.and"))}
                  </dd>
                </div>
              );
            })}
          </dl>
          <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
            {t("notice.intersection")}
          </p>
        </>
      ) : (
        <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
          {t("notice.open")}
        </p>
      )}
      {missing.length > 0 ? (
        <p className="bg-destructive/10 text-destructive flex items-start gap-2 rounded-md p-3 text-sm leading-relaxed text-pretty">
          <TriangleAlertIcon
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0"
          />
          {t("notice.missing")}
        </p>
      ) : null}
    </section>
  );
};

/**
 * Who may read, comment on and download from a record filed under several
 * scopes (an article in its categories), as the server computes it for the
 * scopes the editor holds right now: a reader has to meet every scope's rule.
 * Shown in an editor before saving; the server decides again on every read.
 */
export const ContentAccessEffectiveNotice = (
  props: ContentAccessEffectiveNoticeProps,
) => (
  <RouteMessages namespaces={["core.access"]}>
    <Notice {...props} />
  </RouteMessages>
);
