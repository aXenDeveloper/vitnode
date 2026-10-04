import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import type {
  AutoFormOnSubmit,
  ItemAutoFormComponentProps,
} from "@/components/form/auto-form";
import type { AdminMutationResult } from "@/views/admin/views/core/shared/admin-mutation";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormNullableNumber } from "@/components/form/fields/nullable-number";
import { AutoFormNumber } from "@/components/form/fields/number";
import { useDialog } from "@/components/ui/dialog";

import type { AdminAiModel, AdminAiPricing } from "../ai-query";

import { toAiDecimal } from "../ai-decimal";

const PRICE_FORMAT = { maximumFractionDigits: 6 } as const;

const optionalRate = (value: string | undefined): null | number =>
  value === undefined ? null : Number(value);

export interface AiPricingFormProps {
  model: AdminAiModel;
  onSave: (body: {
    modelId: string;
    pricing: AdminAiPricing;
  }) => Promise<AdminMutationResult<true>>;
}

export const AiPricingFormContent = ({ model, onSave }: AiPricingFormProps) => {
  const t = useTranslations("admin.ai.models.pricing_form");
  const tError = useTranslations("core.global.errors");
  const { setIsDirty, setOpen } = useDialog();
  const rates = model.pricing?.pricing.rates;

  const optional = (value: string | undefined) =>
    z.number().min(0).nullable().default(optionalRate(value));

  const formSchema = z.object({
    inputPerMillion: z
      .number()
      .min(0)
      .default(Number(rates?.inputPerMillion ?? 0)),
    outputPerMillion: z
      .number()
      .min(0)
      .default(Number(rates?.outputPerMillion ?? 0)),
    cacheReadPerMillion: optional(rates?.cacheReadPerMillion),
    cacheWritePerMillion: optional(rates?.cacheWritePerMillion),
    perRequest: optional(rates?.perRequest),
    perImage: optional(rates?.perImage),
  });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async values => {
    const optionalPrice = <TKey extends string>(
      key: TKey,
      value: null | number,
    ): Partial<Record<TKey, string>> =>
      value === null
        ? {}
        : ({ [key]: toAiDecimal(value) } as Record<TKey, string>);
    const pricing: AdminAiPricing = {
      rates: {
        inputPerMillion: toAiDecimal(values.inputPerMillion),
        outputPerMillion: toAiDecimal(values.outputPerMillion),
        ...optionalPrice("cacheReadPerMillion", values.cacheReadPerMillion),
        ...optionalPrice("cacheWritePerMillion", values.cacheWritePerMillion),
        ...optionalPrice("perRequest", values.perRequest),
        ...optionalPrice("perImage", values.perImage),
      },
      // Long-context tiers have no editor here; an override keeps them.
      ...(model.pricing?.pricing.tiers
        ? { tiers: model.pricing.pricing.tiers }
        : {}),
    };

    const result = await onSave({ modelId: model.id, pricing });

    if ("error" in result) {
      toast.error(tError("title"), {
        description: tError("internal_server_error"),
      });

      return;
    }

    toast.success(t("saved.title"), {
      description: t("saved.desc", { name: model.name }),
    });
    setIsDirty?.(false);
    setOpen?.(false);
  };

  const rate =
    (label: string, description?: string) =>
    (props: ItemAutoFormComponentProps) => (
      <AutoFormNumber
        {...props}
        description={description}
        format={PRICE_FORMAT}
        label={label}
        min={0}
        step={0.01}
        unitLabel={t("per_million")}
      />
    );

  const optionalField =
    (label: string, unit: string) => (props: ItemAutoFormComponentProps) => (
      <AutoFormNullableNumber
        {...props}
        format={PRICE_FORMAT}
        label={label}
        min={0}
        orLabel={t("or")}
        step={0.01}
        toggleLabel={t("not_billed")}
        unitLabel={unit}
      />
    );

  return (
    <AutoForm
      fields={[
        {
          component: rate(t("input"), t("input_desc")),
          id: "inputPerMillion",
        },
        { component: rate(t("output")), id: "outputPerMillion" },
        {
          component: optionalField(t("cache_read"), t("per_million")),
          id: "cacheReadPerMillion",
        },
        {
          component: optionalField(t("cache_write"), t("per_million")),
          id: "cacheWritePerMillion",
        },
        {
          component: optionalField(t("per_request"), t("per_request_unit")),
          id: "perRequest",
        },
        {
          component: optionalField(t("per_image"), t("per_image_unit")),
          id: "perImage",
        },
      ]}
      formSchema={formSchema}
      onSubmit={onSubmit}
      submitButtonProps={{ children: t("submit") }}
    />
  );
};
