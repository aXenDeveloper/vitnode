import { cn } from "cn";
import { useLocale, useTranslations } from "use-intl";

import { DateFormat } from "@/components/date-format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatAiPoints } from "@/lib/ai/format-points";
import { aiRunStatusVariant, isAiRunStatus } from "@/lib/ai/run-status";

import type { AiHistoryItem, AiUsageAction } from "./ai-usage-query";

import { SETTINGS_ROW, SettingsGroup } from "../settings-group";

const AiRunStatusLabel = ({ status }: { status: string }) => {
  const t = useTranslations("core.auth.settings.ai.status");

  return (
    <Badge variant={aiRunStatusVariant(status)}>
      {isAiRunStatus(status) ? t(status) : status}
    </Badge>
  );
};

const AiHistoryRow = ({
  description,
  item,
}: {
  description: null | string;
  item: AiHistoryItem;
}) => {
  const t = useTranslations("core.auth.settings.ai.history");
  const locale = useLocale();

  return (
    <li className={cn(SETTINGS_ROW, "flex-wrap justify-between")}>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-medium text-pretty">
          {description ?? item.actionKey}
        </span>
        <span className="text-muted-foreground text-xs">
          <DateFormat date={item.createdAt} />
        </span>
      </div>
      <div className="flex items-center gap-2">
        <AiRunStatusLabel status={item.status} />
        <span className="text-muted-foreground text-sm tabular-nums">
          {item.chargedPoints === null
            ? t("no_charge")
            : t("points", {
                points: formatAiPoints(item.chargedPoints, locale),
              })}
        </span>
      </div>
    </li>
  );
};

export const AiHistoryContent = ({
  actions,
  hasNextPage,
  isFetchingNextPage,
  items,
  onLoadMore,
}: {
  actions: AiUsageAction[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  items: AiHistoryItem[];
  onLoadMore: () => void;
}) => {
  const t = useTranslations("core.auth.settings.ai.history");
  const descriptions = new Map(
    actions.map(action => [action.key, action.description]),
  );

  return (
    <div className="flex flex-col gap-2">
      <SettingsGroup footer={t("footer")} title={t("title")}>
        {items.length === 0 ? (
          <li className={cn(SETTINGS_ROW, "text-muted-foreground text-sm")}>
            {t("empty")}
          </li>
        ) : (
          items.map(item => (
            <AiHistoryRow
              description={descriptions.get(item.actionKey) ?? null}
              item={item}
              key={item.id}
            />
          ))
        )}
      </SettingsGroup>
      {hasNextPage ? (
        <Button
          className="self-center"
          isLoading={isFetchingNextPage}
          onClick={onLoadMore}
          variant="outline"
        >
          {t("load_more")}
        </Button>
      ) : null}
    </div>
  );
};
