import { useTranslations } from "use-intl";

import type {
  PurchaseDisplayState,
  SubscriptionDisplayState,
} from "@/payments/status";

import { Badge } from "@/components/ui/badge";

type BadgeVariant =
  "destructive" | "outline" | "secondary" | "success" | "warning";

const PURCHASE_VARIANTS: Record<PurchaseDisplayState, BadgeVariant> = {
  awaiting_payment: "outline",
  failed: "secondary",
  fulfilled: "success",
  fulfillment_failed: "warning",
  fulfillment_pending: "warning",
  paid: "success",
  partially_refunded: "secondary",
  processing: "warning",
  refunded: "secondary",
};

const SUBSCRIPTION_VARIANTS: Record<SubscriptionDisplayState, BadgeVariant> = {
  active: "success",
  cancellation_scheduled: "warning",
  ended: "secondary",
  incomplete: "outline",
  needs_attention: "destructive",
};

export const PurchaseStateBadge = ({
  state,
}: {
  state: PurchaseDisplayState;
}) => {
  const t = useTranslations("core.payments.purchase_state");

  return <Badge variant={PURCHASE_VARIANTS[state]}>{t(state)}</Badge>;
};

export const SubscriptionStateBadge = ({
  state,
}: {
  state: SubscriptionDisplayState;
}) => {
  const t = useTranslations("core.payments.subscription_state");

  return <Badge variant={SUBSCRIPTION_VARIANTS[state]}>{t(state)}</Badge>;
};
