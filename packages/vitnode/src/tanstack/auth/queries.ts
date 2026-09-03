import type { QueryClient } from "@tanstack/react-query";

import { DEVICES_IDENTITY_ROOT } from "@/views/auth/settings/devices/devices-query";
import { MY_FILES_IDENTITY_ROOT } from "@/views/files/my-files-query";

export const removeUserIdentityQueries = (queryClient: QueryClient): void => {
  queryClient.removeQueries({ queryKey: MY_FILES_IDENTITY_ROOT });
  queryClient.removeQueries({ queryKey: DEVICES_IDENTITY_ROOT });
};
