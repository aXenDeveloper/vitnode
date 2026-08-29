/**
 * `/admin/core/system/integrations` - which of VitNode's integrations are
 * configured and running, for a TanStack Start host.
 *
 *     ./query   one query definition, plus the invalidation an installation-level
 *               change elsewhere should call
 *     ./route   the screen: namespaces, permissions, loader, component
 *     ./server  the SSR transport, reached only through `./query`
 *
 * `IntegrationsContent` is framework-free and imported from
 * `@/views/admin/views/core/system/integrations` by both applications.
 */
export { integrationsQuery, invalidateIntegrations } from "./query";
export type { AdminIntegrationsRouteData } from "./route";
export {
  ADMIN_INTEGRATIONS_NAMESPACES,
  AdminIntegrationsRouteContent,
  loadAdminIntegrationsRoute,
} from "./route";

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
