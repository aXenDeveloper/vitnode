import { PencilIcon, RefreshCwIcon, RotateCcwIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "use-intl";

import type { AdminMutationResult } from "@/views/admin/views/core/shared/admin-mutation";

import { DateFormat } from "@/components/date-format";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { formatAiUsd } from "@/lib/ai/format-points";

import type { AdminAiSyncPricingResult } from "../ai-mutations";
import type { AdminAiModel, AdminAiPricing } from "../ai-query";
import type { AiPricingFormProps } from "./pricing-form-content";

const AiPricingFormContent = React.lazy(async () =>
  import("./pricing-form-content").then(module => ({
    default: module.AiPricingFormContent,
  })),
);

export interface AiModelsContentProps {
  canManage: boolean;
  models: AdminAiModel[];
  onDeletePricing: (modelId: string) => Promise<AdminMutationResult<true>>;
  onSavePricing: AiPricingFormProps["onSave"];
}

const AiPriceLines = ({ pricing }: { pricing: AdminAiPricing }) => {
  const t = useTranslations("admin.ai.models.price");
  const locale = useLocale();
  const { rates } = pricing;
  const usd = (value: string) => formatAiUsd(value, locale);

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
      <div className="flex flex-col gap-0.5">
        <dt className="text-muted-foreground text-xs">{t("input")}</dt>
        <dd className="tabular-nums">{usd(rates.inputPerMillion)}</dd>
      </div>
      <div className="flex flex-col gap-0.5">
        <dt className="text-muted-foreground text-xs">{t("output")}</dt>
        <dd className="tabular-nums">{usd(rates.outputPerMillion)}</dd>
      </div>
      {rates.cacheReadPerMillion === undefined ? null : (
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground text-xs">{t("cache_read")}</dt>
          <dd className="tabular-nums">{usd(rates.cacheReadPerMillion)}</dd>
        </div>
      )}
      {rates.cacheWritePerMillion === undefined ? null : (
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground text-xs">{t("cache_write")}</dt>
          <dd className="tabular-nums">{usd(rates.cacheWritePerMillion)}</dd>
        </div>
      )}
      {rates.perRequest === undefined ? null : (
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground text-xs">{t("per_request")}</dt>
          <dd className="tabular-nums">{usd(rates.perRequest)}</dd>
        </div>
      )}
      {rates.perImage === undefined ? null : (
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground text-xs">{t("per_image")}</dt>
          <dd className="tabular-nums">{usd(rates.perImage)}</dd>
        </div>
      )}
      {pricing.tiers?.length ? (
        <p className="text-muted-foreground col-span-2 text-xs">
          {t("tiers", { count: pricing.tiers.length })}
        </p>
      ) : null}
    </dl>
  );
};

const EditPricingAction = ({
  model,
  onSave,
}: {
  model: AdminAiModel;
  onSave: AiPricingFormProps["onSave"];
}) => {
  const t = useTranslations("admin.ai.models.pricing_form");

  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <PencilIcon />
        {t("open")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("title", { name: model.name })}</DialogTitle>
          <DialogDescription>{t("desc")}</DialogDescription>
        </DialogHeader>
        <React.Suspense
          fallback={
            <div className="flex items-center justify-center">
              <Spinner size="xl" />
            </div>
          }
        >
          <AiPricingFormContent model={model} onSave={onSave} />
        </React.Suspense>
      </DialogContent>
    </Dialog>
  );
};

const ResetPricingAction = ({
  model,
  onDelete,
}: {
  model: AdminAiModel;
  onDelete: AiModelsContentProps["onDeletePricing"];
}) => {
  const t = useTranslations("admin.ai.models.reset");
  const tError = useTranslations("core.global.errors");
  const [open, setOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  return (
    <AlertDialog onOpenChange={setOpen} open={open}>
      <AlertDialogTrigger render={<Button size="sm" variant="ghost" />}>
        <RotateCcwIcon />
        {t("open")}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("desc", { name: model.name })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <Button
            isLoading={isPending}
            onClick={() => {
              startTransition(async () => {
                const result = await onDelete(model.id);
                if ("error" in result) {
                  toast.error(tError("title"), {
                    description: tError("internal_server_error"),
                  });

                  return;
                }

                toast.success(t("success"), {
                  description: t("success_desc", { name: model.name }),
                });
                setOpen(false);
              });
            }}
            variant="destructive"
          >
            {t("confirm")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

const AiModelCard = ({
  canManage,
  model,
  onDeletePricing,
  onSavePricing,
}: Omit<AiModelsContentProps, "models"> & { model: AdminAiModel }) => {
  const t = useTranslations("admin.ai.models");

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{model.name}</CardTitle>
        <CardDescription className="truncate font-mono text-xs">
          {model.provider}/{model.model}
        </CardDescription>
        <CardAction>
          {model.pricing ? (
            <Badge
              variant={
                model.pricing.source === "manual" ? "warning" : "outline"
              }
            >
              {t(`source.${model.pricing.source}`)}
            </Badge>
          ) : (
            <Badge variant="destructive">{t("source.none")}</Badge>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul aria-label={t("capabilities")} className="flex flex-wrap gap-1">
          {model.capabilities.map(capability => (
            <li key={capability}>
              <Badge variant="secondary">{t(`capability.${capability}`)}</Badge>
            </li>
          ))}
        </ul>

        {model.pricing ? (
          <div className="flex flex-col gap-2">
            <span className="text-muted-foreground text-xs">
              {t("per_million_hint")}
            </span>
            <AiPriceLines pricing={model.pricing.pricing} />
          </div>
        ) : (
          <p className="text-muted-foreground leading-relaxed text-pretty">
            {t("no_price")}
          </p>
        )}

        {model.catalogPricing ? (
          <p className="text-muted-foreground text-xs leading-relaxed text-pretty">
            {t("catalog_hint")}
          </p>
        ) : null}

        {model.pricing?.updatedAt ? (
          <p className="text-muted-foreground text-xs">
            {t("updated")} <DateFormat date={model.pricing.updatedAt} />
          </p>
        ) : null}
      </CardContent>
      {canManage ? (
        <CardFooter className="flex flex-wrap gap-2">
          <EditPricingAction model={model} onSave={onSavePricing} />
          {model.pricing?.source === "manual" ? (
            <ResetPricingAction model={model} onDelete={onDeletePricing} />
          ) : null}
        </CardFooter>
      ) : null}
    </Card>
  );
};

export const AiSyncPricingButton = ({
  onSync,
}: {
  onSync: () => Promise<AdminMutationResult<AdminAiSyncPricingResult>>;
}) => {
  const t = useTranslations("admin.ai.models.sync");
  const tError = useTranslations("core.global.errors");
  const [isPending, startTransition] = React.useTransition();

  return (
    <Button
      isLoading={isPending}
      onClick={() => {
        startTransition(async () => {
          const result = await onSync();
          if ("error" in result) {
            toast.error(t("error"), {
              description:
                result.error.status === 502
                  ? t("error_desc")
                  : tError("internal_server_error"),
            });

            return;
          }

          toast.success(t("success"), {
            description: t("success_desc", {
              unchanged: result.data.unchanged.length,
              unpriced: result.data.unpriced.length,
              updated: result.data.updated.length,
            }),
          });
        });
      }}
      variant="outline"
    >
      <RefreshCwIcon />
      {t("button")}
    </Button>
  );
};

export const AiModelsContent = ({ models, ...props }: AiModelsContentProps) => {
  const t = useTranslations("admin.ai.models");

  if (models.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{t("empty.title")}</EmptyTitle>
          <EmptyDescription>{t("empty.desc")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {models.map(model => (
        <AiModelCard key={model.id} model={model} {...props} />
      ))}
    </div>
  );
};
