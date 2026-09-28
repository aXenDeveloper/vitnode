import type { QueryClient } from "@tanstack/react-query";

import { useQueryClient } from "@tanstack/react-query";
import React from "react";

import type {
  AddPasskey,
  DeletePasskey,
  RenamePasskey,
} from "@/views/auth/settings/passkeys/passkeys-mutations";

import {
  addPasskeyInBrowser,
  deletePasskeyInBrowser,
  renamePasskeyInBrowser,
} from "@/views/auth/settings/passkeys/passkeys-mutations";
import { passkeysQueryKey } from "@/views/auth/settings/passkeys/passkeys-query";

export const invalidatePasskeys = async (
  queryClient: QueryClient,
  userId: number,
): Promise<void> =>
  await queryClient.invalidateQueries({ queryKey: passkeysQueryKey(userId) });

export interface PasskeyActions {
  onAdd: AddPasskey;
  onDelete: DeletePasskey;
  onRename: RenamePasskey;
}

export const createPasskeyActions = (
  queryClient: QueryClient,
  userId: number,
): PasskeyActions => ({
  onAdd: async () => {
    const result = await addPasskeyInBrowser();
    if (result.ok || result.failure === "already_registered") {
      await invalidatePasskeys(queryClient, userId);
    }

    return result;
  },
  onDelete: async args => {
    const result = await deletePasskeyInBrowser(args);
    if (result.ok || result.failure === "not_found") {
      await invalidatePasskeys(queryClient, userId);
    }

    return result;
  },
  onRename: async args => {
    const result = await renamePasskeyInBrowser(args);
    if (result.ok || result.failure === "not_found") {
      await invalidatePasskeys(queryClient, userId);
    }

    return result;
  },
});

export const usePasskeyActions = (userId: number): PasskeyActions => {
  const queryClient = useQueryClient();

  return React.useMemo(
    () => createPasskeyActions(queryClient, userId),
    [queryClient, userId],
  );
};
