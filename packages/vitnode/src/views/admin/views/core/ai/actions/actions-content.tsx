import { FlaskConicalIcon, PencilIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
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

import type { AdminAiAction, AdminAiModel } from "../ai-query";
import type { AiActionFormProps } from "./action-form-content";
import type { AiActionTestProps } from "./action-test-content";

import { AiActionLabel } from "../ai-labels";

const AiActionFormContent = React.lazy(async () =>
  import("./action-form-content").then(module => ({
    default: module.AiActionFormContent,
  })),
);

const AiActionTestContent = React.lazy(async () =>
  import("./action-test-content").then(module => ({
    default: module.AiActionTestContent,
  })),
);

const DialogFallback = () => (
  <div className="flex items-center justify-center">
    <Spinner size="xl" />
  </div>
);

export interface AiActionsContentProps {
  actions: AdminAiAction[];
  canManage: boolean;
  models: AdminAiModel[];
  onSave: AiActionFormProps["onSave"];
  onTest: AiActionTestProps["onTest"];
}

export const EditAiActionAction = ({
  action,
  models,
  onSave,
}: Pick<AiActionsContentProps, "models" | "onSave"> & {
  action: AdminAiAction;
}) => {
  const t = useTranslations("admin.ai.actions.form");

  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <PencilIcon />
        {t("open")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {action.key}
          </DialogDescription>
        </DialogHeader>
        <React.Suspense fallback={<DialogFallback />}>
          <AiActionFormContent
            action={action}
            models={models}
            onSave={onSave}
          />
        </React.Suspense>
      </DialogContent>
    </Dialog>
  );
};

const TestAiActionAction = ({
  action,
  onTest,
}: Pick<AiActionsContentProps, "onTest"> & { action: AdminAiAction }) => {
  const t = useTranslations("admin.ai.actions.test");

  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" variant="ghost" />}>
        <FlaskConicalIcon />
        {t("open")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {action.key}
          </DialogDescription>
        </DialogHeader>
        <React.Suspense fallback={<DialogFallback />}>
          <AiActionTestContent actionKey={action.key} onTest={onTest} />
        </React.Suspense>
      </DialogContent>
    </Dialog>
  );
};

const AiActionFact = ({
  label,
  value,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
}) => (
  <div className="flex flex-col gap-0.5">
    <dt className="text-muted-foreground text-xs">{label}</dt>
    <dd className="text-sm">{value}</dd>
  </div>
);

const AiActionCard = ({
  action,
  canManage,
  models,
  onSave,
  onTest,
}: Omit<AiActionsContentProps, "actions"> & { action: AdminAiAction }) => {
  const t = useTranslations("admin.ai.actions");
  const tOrigin = useTranslations("admin.ai.origin");
  const modelName = (id: null | string) =>
    id === null
      ? t("model_default")
      : (models.find(model => model.id === id)?.name ?? id);
  const dailyLimit = action.settings.dailyLimit ?? action.defaults.dailyLimit;
  const canTest = action.actors.includes("user");

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>
          <AiActionLabel
            actionKey={action.key}
            description={action.description}
          />
        </CardTitle>
        <CardAction>
          <Badge variant={action.settings.enabled ? "success" : "outline"}>
            {action.settings.enabled ? t("enabled") : t("disabled")}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-4">
          <AiActionFact
            label={t("model")}
            value={modelName(action.settings.modelId)}
          />
          <AiActionFact
            label={t("daily_limit")}
            value={dailyLimit ?? t("no_limit")}
          />
          <AiActionFact
            label={t("actors")}
            value={action.actors.map(actor => tOrigin(actor)).join(", ")}
          />
          <AiActionFact
            label={t("compatible")}
            value={
              action.compatibleModelIds.length === 0 ? (
                <span className="text-destructive">{t("no_compatible")}</span>
              ) : (
                action.compatibleModelIds.length
              )
            }
          />
        </dl>
      </CardContent>
      {canManage ? (
        <CardFooter className="flex flex-wrap gap-2">
          <EditAiActionAction action={action} models={models} onSave={onSave} />
          {canTest ? (
            <TestAiActionAction action={action} onTest={onTest} />
          ) : null}
        </CardFooter>
      ) : null}
    </Card>
  );
};

export const AiActionsContent = ({
  actions,
  ...props
}: AiActionsContentProps) => {
  const t = useTranslations("admin.ai.actions");

  if (actions.length === 0) {
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
    <div className="flex flex-col gap-4">
      {actions.map(action => (
        <AiActionCard action={action} key={action.key} {...props} />
      ))}
    </div>
  );
};
