import { ScanSearchIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { AdminMutationResult } from "@/views/admin/views/core/shared/admin-mutation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import type { AdminAiAltSweepResult } from "../ai-mutations";
import type { AdminAiAltStatus } from "../ai-query";

const COUNT_KEYS = [
  "pending",
  "completed",
  "failed",
  "waitingBudget",
  "skipped",
] as const;

export interface AiAltStatusProps {
  canManage: boolean;
  data: AdminAiAltStatus;
  onSweep: () => Promise<AdminMutationResult<AdminAiAltSweepResult>>;
}

const SweepAltButton = ({ onSweep }: Pick<AiAltStatusProps, "onSweep">) => {
  const t = useTranslations("admin.ai.settings.alt_status.sweep");
  const tError = useTranslations("core.global.errors");
  const [isPending, startTransition] = React.useTransition();

  return (
    <Button
      isLoading={isPending}
      onClick={() => {
        startTransition(async () => {
          const result = await onSweep();
          if ("error" in result) {
            toast.error(tError("title"), {
              description: tError("internal_server_error"),
            });

            return;
          }

          toast.success(t("success"), {
            description: t("success_desc", {
              enqueued: result.data.enqueued,
              scanned: result.data.scanned,
            }),
          });
        });
      }}
      size="sm"
      variant="outline"
    >
      <ScanSearchIcon />
      {t("button")}
    </Button>
  );
};

export const AiAltStatusContent = ({
  canManage,
  data,
  onSweep,
}: AiAltStatusProps) => {
  const t = useTranslations("admin.ai.settings.alt_status");

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {t("title")}
          <Badge variant={data.enabled ? "success" : "outline"}>
            {data.enabled ? t("on") : t("off")}
          </Badge>
        </CardTitle>
        <CardDescription className="leading-relaxed text-pretty">
          {t("desc", { eligible: data.eligibleImages })}
        </CardDescription>
        {canManage ? (
          <CardAction>
            <SweepAltButton onSweep={onSweep} />
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-5">
          {COUNT_KEYS.map(key => (
            <div className="flex flex-col gap-0.5" key={key}>
              <dt className="text-muted-foreground text-xs">
                {t(`counts.${key}`)}
              </dt>
              <dd className="text-lg font-semibold tabular-nums">
                {data.counts[key]}
              </dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">
            {t("languages")}
          </span>
          {data.languages.length === 0 ? (
            <span className="text-sm">{t("no_languages")}</span>
          ) : (
            <ul aria-label={t("languages")} className="flex flex-wrap gap-1">
              {data.languages.map(code => (
                <li key={code}>
                  <Badge variant="secondary">{code}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
