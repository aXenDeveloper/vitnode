import { useTranslations } from "use-intl";

import type {
  FulfillmentStatus,
  PurchasePaymentStatus,
  SubscriptionStatus,
} from "@/payments/status";

import { Badge } from "@/components/ui/badge";

type Variant = "destructive" | "outline" | "secondary" | "success" | "warning";

const PAYMENT: Record<PurchasePaymentStatus, Variant> = {
  awaiting_payment: "outline",
  canceled: "secondary",
  expired: "secondary",
  failed: "destructive",
  paid: "success",
  processing: "warning",
};

const FULFILLMENT: Record<FulfillmentStatus, Variant> = {
  failed: "destructive",
  fulfilled: "success",
  not_started: "outline",
  pending: "warning",
};

const SUBSCRIPTION: Record<SubscriptionStatus, Variant> = {
  active: "success",
  canceled: "secondary",
  incomplete: "outline",
  incomplete_expired: "secondary",
  past_due: "destructive",
  paused: "warning",
  unpaid: "destructive",
};

const WORK: Record<string, Variant> = {
  completed: "success",
  failed: "destructive",
  pending: "warning",
  processed: "success",
};

export const PaymentStatusBadge = ({
  status,
}: {
  status: PurchasePaymentStatus;
}) => {
  const t = useTranslations("admin.payments.payment_status");

  return <Badge variant={PAYMENT[status]}>{t(status)}</Badge>;
};

export const FulfillmentStatusBadge = ({
  status,
}: {
  status: FulfillmentStatus;
}) => {
  const t = useTranslations("admin.payments.fulfillment_status");

  return <Badge variant={FULFILLMENT[status]}>{t(status)}</Badge>;
};

export const AdminSubscriptionStatusBadge = ({
  status,
}: {
  status: SubscriptionStatus;
}) => {
  const t = useTranslations("admin.payments.subscription_status");

  return <Badge variant={SUBSCRIPTION[status]}>{t(status)}</Badge>;
};

/** Queue-like states of webhook events and fulfillment work. */
export const WorkStatusBadge = ({
  kind,
  status,
}: {
  kind: "event" | "work";
  status: string;
}) => {
  const tEvent = useTranslations("admin.payments.event_status");
  const tWork = useTranslations("admin.payments.work_status");
  const label =
    kind === "event"
      ? tEvent(status as "failed" | "pending" | "processed")
      : tWork(status as "completed" | "failed" | "pending");

  return <Badge variant={WORK[status] ?? "outline"}>{label}</Badge>;
};
