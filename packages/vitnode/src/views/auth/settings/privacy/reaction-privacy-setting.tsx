import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { manifest } from "@vitnode/api/manifest";
import { SmilePlusIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { fetcher } from "@/tanstack/fetcher";
import { RouteMessages } from "@/tanstack/i18n/route-messages";
import { REACTIONS_QUERY_ROOT } from "@/tanstack/reactions/query";
import { SEARCH_QUERY_ROOT } from "@/views/search/search-feed-query";

import { SETTINGS_ROW, SettingsGroup } from "../settings-group";

const settingsQueryKey = [...REACTIONS_QUERY_ROOT, "me", "settings"] as const;

const Setting = () => {
  const t = useTranslations("core.reactions.settings");
  const tErrors = useTranslations("core.global.errors");
  const queryClient = useQueryClient();
  const labelId = React.useId();
  const descId = React.useId();
  const query = useQuery({
    queryFn: async () => {
      const response = await fetcher({
        plugin: manifest.id,
        method: "get",
        module: "reactions",
        path: "/me/settings",
      });
      if (!response.ok) throw new Error(`Answered ${response.status}.`);

      return await response.json();
    },
    queryKey: settingsQueryKey,
  });
  const mutation = useMutation({
    mutationFn: async (showReactionsOnProfile: boolean) => {
      const response = await fetcher({
        plugin: manifest.id,
        method: "put",
        module: "reactions",
        path: "/me/settings",
        args: { body: { showReactionsOnProfile } },
      });
      if (!response.ok) throw new Error(`Answered ${response.status}.`);

      return await response.json();
    },
    onError: () => {
      toast.error(tErrors("title"), {
        description: tErrors("internal_server_error"),
      });
    },
    onSuccess: async data => {
      queryClient.setQueryData(settingsQueryKey, data);
      await queryClient.invalidateQueries({
        queryKey: [...SEARCH_QUERY_ROOT, "timeline"],
      });
      toast.success(t("saved"), { description: t("saved_desc") });
    },
  });

  return (
    <SettingsGroup title={t("title")}>
      <li className={SETTINGS_ROW}>
        <SmilePlusIcon
          aria-hidden="true"
          className="text-muted-foreground size-4 shrink-0"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-foreground text-sm font-medium" id={labelId}>
            {t("show_on_profile")}
          </span>
          <span
            className="text-muted-foreground text-sm leading-relaxed text-pretty"
            id={descId}
          >
            {t("show_on_profile_desc")}
          </span>
        </div>
        {query.isPending ? (
          <Skeleton className="h-5 w-9 rounded-full" />
        ) : (
          <Switch
            aria-busy={mutation.isPending}
            aria-describedby={descId}
            aria-labelledby={labelId}
            checked={
              mutation.isPending
                ? mutation.variables
                : (query.data?.showReactionsOnProfile ?? true)
            }
            disabled={mutation.isPending || query.isError}
            onCheckedChange={next => {
              mutation.mutate(next);
            }}
          />
        )}
      </li>
    </SettingsGroup>
  );
};

/** "Show my reactions on my profile", in the account settings' privacy area. */
export const ReactionPrivacySetting = () => (
  <React.Suspense fallback={null}>
    <RouteMessages namespaces={["core.global", "core.reactions"]}>
      <Setting />
    </RouteMessages>
  </React.Suspense>
);
