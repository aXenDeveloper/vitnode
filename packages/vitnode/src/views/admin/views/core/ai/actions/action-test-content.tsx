import React from "react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "use-intl";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";
import type { AdminMutationResult } from "@/views/admin/views/core/shared/admin-mutation";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormTextarea } from "@/components/form/fields/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { formatAiPoints } from "@/lib/ai/format-points";

import type { AdminAiTestResult } from "../ai-mutations";

const parsesAsJson = (value: string): boolean => {
  try {
    JSON.parse(value);

    return true;
  } catch {
    return false;
  }
};

export interface AiActionTestProps {
  actionKey: string;
  onTest: (body: {
    input: unknown;
    key: string;
  }) => Promise<AdminMutationResult<AdminAiTestResult>>;
}

const AiActionTestResultContent = ({
  result,
}: {
  result: AdminAiTestResult;
}) => {
  const t = useTranslations("admin.ai.actions.test");
  const locale = useLocale();
  const output =
    typeof result.output === "string"
      ? result.output
      : JSON.stringify(result.output, null, 2);

  return (
    <section aria-label={t("result")} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{t("result")}</span>
        <Badge variant="secondary">
          {t("charged", {
            points: formatAiPoints(result.usage.chargedPoints, locale),
          })}
        </Badge>
        <Badge variant="outline">{result.usage.modelId}</Badge>
        {result.usage.costKnown ? null : (
          <Badge variant="warning">{t("cost_unknown")}</Badge>
        )}
      </div>
      <pre className="bg-muted max-h-72 overflow-auto rounded-md p-4 text-xs leading-relaxed whitespace-pre-wrap">
        {output}
      </pre>
      <p className="text-muted-foreground text-xs">
        {t("run_id", { id: result.runId })}
      </p>
    </section>
  );
};

export const AiActionTestContent = ({
  actionKey,
  onTest,
}: AiActionTestProps) => {
  const t = useTranslations("admin.ai.actions.test");
  const tError = useTranslations("core.global.errors");
  const [result, setResult] = React.useState<AdminAiTestResult | null>(null);

  const formSchema = z.object({
    input: z
      .string()
      .min(1)
      .max(100_000)
      .refine(parsesAsJson, { message: t("invalid_json") })
      .default("{}"),
  });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async values => {
    const response = await onTest({
      input: JSON.parse(values.input) as unknown,
      key: actionKey,
    });

    if ("error" in response) {
      setResult(null);
      toast.error(t("failed"), {
        description: response.error.message ?? tError("internal_server_error"),
      });

      return;
    }

    setResult(response.data);
    toast.success(t("done.title"), {
      description: t("done.desc", { id: response.data.runId }),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <Alert variant="warning">
        <AlertTitle>{t("billed.title")}</AlertTitle>
        <AlertDescription>{t("billed.desc")}</AlertDescription>
      </Alert>

      {result ? <AiActionTestResultContent result={result} /> : null}

      <AutoForm
        fields={[
          {
            component: props => (
              <AutoFormTextarea
                {...props}
                className="font-mono text-xs"
                description={t("input_desc")}
                label={t("input")}
                rows={6}
              />
            ),
            id: "input",
          },
        ]}
        formSchema={formSchema}
        onSubmit={onSubmit}
        submitButtonProps={{ children: t("submit") }}
      />
    </div>
  );
};
