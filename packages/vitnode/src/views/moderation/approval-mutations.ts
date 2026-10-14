import { CONFIG_PLUGIN } from "@/config";
import { fetcherClient } from "@/lib/fetcher-client";

const DECISION_FAILURES = [
  "decided",
  "forbidden",
  "gone",
  "notFound",
  "stale",
] as const;

export type ApprovalFailure =
  | "rate_limited"
  | "unknown"
  | (typeof DECISION_FAILURES)[number];

export type ApprovalResult =
  | { data: { id: number; status: string }; ok: true }
  | { failure: ApprovalFailure; ok: false };

const isDecisionFailure = (
  value: unknown,
): value is (typeof DECISION_FAILURES)[number] =>
  DECISION_FAILURES.some(failure => failure === value);

const failureOf = async (response: Response): Promise<ApprovalFailure> => {
  if (response.status === 429) return "rate_limited";
  const body = (await response.json().catch(() => null)) as null | {
    error?: unknown;
  };
  if (isDecisionFailure(body?.error)) return body.error;
  if (response.status === 403) return "forbidden";
  if (response.status === 404) return "notFound";

  return "unknown";
};

const settle = async (
  request: () => Promise<Response>,
): Promise<ApprovalResult> => {
  try {
    const response = await request();
    if (response.status !== 200) {
      return { failure: await failureOf(response), ok: false };
    }

    return {
      data: (await response.json()) as { id: number; status: string },
      ok: true,
    };
  } catch {
    return { failure: "unknown", ok: false };
  }
};

const options = { credentials: "include" } as const;

export const approveSubmission = async ({ id }: { id: number }) =>
  await settle(
    async () =>
      await fetcherClient({
        plugin: CONFIG_PLUGIN.pluginId,
        args: { params: { id } },
        method: "post",
        module: "moderation",
        options,
        path: "/approvals/{id}/approve",
      }),
  );

export const rejectSubmission = async ({
  id,
  reason,
}: {
  id: number;
  reason: null | string;
}) =>
  await settle(
    async () =>
      await fetcherClient({
        plugin: CONFIG_PLUGIN.pluginId,
        args: { body: { reason }, params: { id } },
        method: "post",
        module: "moderation",
        options,
        path: "/approvals/{id}/reject",
      }),
  );
