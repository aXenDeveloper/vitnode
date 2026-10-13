import { MAX_NAMESPACES } from "@/routing/namespaces";
import { RouteMessages } from "@/tanstack/i18n/route-messages";
import { MODCP_NAMESPACES } from "@/tanstack/moderation/namespaces";

export const namespacesForLabels = (
  keys: readonly (null | string | undefined)[],
): string[] => {
  const namespaces = new Set<string>();
  for (const key of keys) {
    if (!key || !key.includes(".")) continue;
    namespaces.add(key.slice(0, key.lastIndexOf(".")));
  }

  return [...MODCP_NAMESPACES, ...namespaces].slice(0, MAX_NAMESPACES);
};

export const ModcpPluginMessages = ({
  children,
  labels,
}: {
  children: React.ReactNode;
  labels: readonly (null | string | undefined)[];
}) => (
  <RouteMessages namespaces={namespacesForLabels(labels)}>
    {children}
  </RouteMessages>
);
