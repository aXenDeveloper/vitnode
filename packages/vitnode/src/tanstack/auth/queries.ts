import type { QueryClient } from "@tanstack/react-query";

import { DEVICES_IDENTITY_ROOT } from "@/views/auth/settings/devices/devices-query";
import { PASSKEYS_IDENTITY_ROOT } from "@/views/auth/settings/passkeys/passkeys-query";
import { SSO_CONNECTIONS_IDENTITY_ROOT } from "@/views/auth/settings/sso/sso-connections-query";
import { MY_FILES_IDENTITY_ROOT } from "@/views/files/my-files-query";
import { NOTIFICATIONS_IDENTITY_ROOT } from "@/views/notifications/notifications-query";

export const removeUserIdentityQueries = (queryClient: QueryClient): void => {
  queryClient.removeQueries({ queryKey: MY_FILES_IDENTITY_ROOT });
  queryClient.removeQueries({ queryKey: DEVICES_IDENTITY_ROOT });
  queryClient.removeQueries({ queryKey: PASSKEYS_IDENTITY_ROOT });
  queryClient.removeQueries({ queryKey: SSO_CONNECTIONS_IDENTITY_ROOT });
  queryClient.removeQueries({ queryKey: NOTIFICATIONS_IDENTITY_ROOT });
};
