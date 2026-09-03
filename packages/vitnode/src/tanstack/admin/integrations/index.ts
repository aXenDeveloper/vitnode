export { integrationsQuery, invalidateIntegrations } from "./query";
export type { AdminIntegrationsRouteData } from "./route";
export {
  ADMIN_INTEGRATIONS_NAMESPACES,
  loadAdminIntegrationsRoute,
} from "./route";
export { AdminIntegrationsRouteContent } from "./screen";

export type {
  AdminIntegrationModel,
  AdminIntegrations,
} from "@/views/admin/views/core/system/integrations/integrations-query";
export { integrationsQueryKey } from "@/views/admin/views/core/system/integrations/integrations-query";
export type {
  SendTestEmail,
  SendTestEmailBody,
} from "@/views/admin/views/core/system/integrations/send-test-email/send-test-email-mutation";
export { sendTestEmailInBrowser } from "@/views/admin/views/core/system/integrations/send-test-email/send-test-email-mutation";
