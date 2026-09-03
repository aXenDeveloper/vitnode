import type { AnyContentTypeDefinition } from "@/content/types";

export const hasContentDelivery = (
  definition: AnyContentTypeDefinition,
): boolean => definition.delivery.enabled;

export const contentDeliveryRequestLocale = (
  definition: AnyContentTypeDefinition,
  locale: string | undefined,
): string | undefined => (definition.localization.enabled ? locale : undefined);
