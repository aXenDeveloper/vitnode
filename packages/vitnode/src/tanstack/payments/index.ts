/**
 * Payments UI for the host app and for plugins: query options, the money
 * formatter, state badges, checkout/portal hooks and the return poller. Every
 * request goes through the universal fetcher; nothing here touches the API
 * config or a provider.
 */
export { BILLING_NAMESPACES, loadBillingRoute } from "./billing-route";

export { BillingContent } from "@/views/payments/billing/billing-content";
export {
  MoneyText,
  useCurrencyDisplay,
  useMoneyFormatter,
} from "@/views/payments/money-text";
export * from "@/views/payments/payments-query";
export {
  PurchaseStateBadge,
  SubscriptionStateBadge,
} from "@/views/payments/state-badges";
export type { CheckoutChoice } from "@/views/payments/use-checkout";
export {
  useBillingPortal,
  useCancelPurchase,
  useStartCheckout,
} from "@/views/payments/use-checkout";
export {
  PURCHASE_RETURN_MAX_CHECKS,
  purchaseReturnDelay,
  usePurchaseReturn,
} from "@/views/payments/use-purchase-return";
