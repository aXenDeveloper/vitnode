import type { AnyContentTypeDefinition } from "@vitnode/api/content/types";

export const hasContentDelivery = (
  definition: AnyContentTypeDefinition,
): boolean => definition.delivery.enabled;

export const contentDeliveryRequestLocale = (
  definition: AnyContentTypeDefinition,
  locale: string | undefined,
): string | undefined => (definition.localization.enabled ? locale : undefined);
