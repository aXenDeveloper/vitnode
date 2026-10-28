import type { QueryClient } from "@tanstack/react-query";

import { INTL_QUERY_SCOPE } from "../i18n/query";
import { SESSION_QUERY_KEY } from "./state";
import { DEVICES_IDENTITY_ROOT } from "@/views/auth/settings/devices/devices-query";
import { PASSKEYS_IDENTITY_ROOT } from "@/views/auth/settings/passkeys/passkeys-query";
import { SSO_CONNECTIONS_IDENTITY_ROOT } from "@/views/auth/settings/sso/sso-connections-query";
import { MY_FILES_IDENTITY_ROOT } from "@/views/files/my-files-query";
import { NOTIFICATIONS_IDENTITY_ROOT } from "@/views/notifications/notifications-query";

const isKept = (queryKey: readonly unknown[]): boolean =>
  // The session itself (refetched right after) and translations, which say
  // the same thing to everybody.
  (queryKey[0] === SESSION_QUERY_KEY[0] && queryKey[1] === SESSION_QUERY_KEY[1]) ||
  INTL_QUERY_SCOPE.every((part, index) => queryKey[index] === part);

/**
 * Drops everything the previous visitor's identity may have shaped, after a
 * sign-in, a sign-out or an account switch. That is more than their files and
 * devices: with access rules, a forum list, an article, search results and
 * comment permissions all depend on whose roles asked - so every cached
 * answer goes, and pages read them again as the new visitor. Only the session
 * and translations stay.
 */
export const removeUserIdentityQueries = (queryClient: QueryClient): void => {
  queryClient.removeQueries({ queryKey: MY_FILES_IDENTITY_ROOT });
  queryClient.removeQueries({ queryKey: DEVICES_IDENTITY_ROOT });
  queryClient.removeQueries({ queryKey: PASSKEYS_IDENTITY_ROOT });
  queryClient.removeQueries({ queryKey: SSO_CONNECTIONS_IDENTITY_ROOT });
  queryClient.removeQueries({ queryKey: NOTIFICATIONS_IDENTITY_ROOT });
  queryClient.removeQueries({ predicate: query => !isKept(query.queryKey) });
};
