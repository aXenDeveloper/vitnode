import { queryOptions } from "@tanstack/react-query";
import { manifest } from "@vitnode/api/manifest";

import { fetcherClient } from "@/lib/fetcher-client";
import { RECORD_STALE_TIME } from "@/lib/query-freshness";
import { fetcher } from "@/tanstack/fetcher";

export class AccountDeletionRequestError extends Error {
  constructor(status: number) {
    super(`The account deletion API answered ${status}.`);
    this.name = "AccountDeletionRequestError";
    this.status = status;
  }

  readonly status: number;
}

export const fetchAccountDeletionStatus = async () => {
  const response = await fetcher({
    plugin: manifest.id,
    method: "get",
    module: "users",
    path: "/me/account-deletion",
  });

  if (!response.ok) throw new AccountDeletionRequestError(response.status);

  return await response.json();
};

export type AccountDeletionStatus = Awaited<
  ReturnType<typeof fetchAccountDeletionStatus>
>;

export const accountDeletionQueryKey = (userId: number) =>
  ["account-deletion", "user", userId] as const;

export const accountDeletionQueryOptions = ({ userId }: { userId: number }) =>
  queryOptions({
    queryFn: fetchAccountDeletionStatus,
    queryKey: accountDeletionQueryKey(userId),
    retry: false,
    /** {@link RECORD_STALE_TIME} - Staff can schedule or cancel from the AdminCP. */
    staleTime: RECORD_STALE_TIME,
  });

export type RequestAccountDeletionResult =
  | {
      error:
        | "invalid_password"
        | "not_allowed"
        | "password_required"
        | "reauthentication_required"
        | "server_error"
        | "staff_account";
      ok: false;
    }
  | { ok: true; scheduledAt: Date };

const isKnownError = (
  value: unknown,
): value is Exclude<RequestAccountDeletionResult, { ok: true }>["error"] =>
  value === "invalid_password" ||
  value === "not_allowed" ||
  value === "password_required" ||
  value === "reauthentication_required" ||
  value === "staff_account";

export const requestAccountDeletion = async ({
  password,
}: {
  password?: string;
}): Promise<RequestAccountDeletionResult> => {
  try {
    const response = await fetcherClient({
      plugin: manifest.id,
      args: { body: { password } },
      method: "post",
      module: "users",
      path: "/me/account-deletion",
    });
    if (response.status === 201) {
      const { scheduledAt } = await response.json();

      return { ok: true, scheduledAt: new Date(scheduledAt) };
    }

    const body: unknown = await response.json().catch(() => null);
    const error =
      typeof body === "object" && body !== null && "error" in body
        ? body.error
        : null;

    return { error: isKnownError(error) ? error : "server_error", ok: false };
  } catch {
    return { error: "server_error", ok: false };
  }
};

export const cancelAccountDeletion = async (): Promise<boolean> => {
  try {
    const response = await fetcherClient({
      plugin: manifest.id,
      method: "delete",
      module: "users",
      path: "/me/account-deletion",
    });

    return response.ok || response.status === 404;
  } catch {
    return false;
  }
};

/**
 * Fetches the member's data export and hands it to the browser as a download.
 * Browser-only.
 */
export const downloadPersonalData = async (): Promise<boolean> => {
  try {
    const response = await fetcherClient({
      plugin: manifest.id,
      method: "get",
      module: "users",
      path: "/me/personal-data",
    });
    if (!response.ok) return false;

    const blob = new Blob([JSON.stringify(await response.json(), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `personal-data-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);

    return true;
  } catch {
    return false;
  }
};
