import { useTranslations } from "use-intl";

import type { FilterDataTable } from "@/components/table/filters";

import { PAYMENT_PERIOD_FILTERS } from "./payments-admin-query";

/** Currency, provider and period - the filters every payments list shares. */
export const usePaymentFilters = ({
  currencies,
  providers,
}: {
  currencies: string[];
  providers: string[];
}): FilterDataTable[] => {
  const t = useTranslations("admin.payments.filters");

  return [
    {
      id: "currency",
      label: t("currency"),
      options: currencies.map(code => ({ label: code, value: code })),
    },
    {
      id: "provider",
      label: t("provider"),
      options: providers.map(id => ({ label: id, value: id })),
    },
    {
      id: "period",
      label: t("period"),
      options: PAYMENT_PERIOD_FILTERS.map(period => ({
        label: t(`periods.${period}`),
        value: period,
      })),
    },
  ];
};
