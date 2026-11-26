import type { zodSignUps } from "@vitnode/api/modules/admin/users/routes/sign-ups.route";
import type { z } from "zod";

import { queryOptions } from "@tanstack/react-query";
import { manifest } from "@vitnode/api/manifest";

import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";

import { OPERATIONAL_STALE_TIME } from "@/lib/query-freshness";
import { fetcher } from "@/tanstack/fetcher";
import { AdminRequestError } from "@/views/admin/admin-request";
import {
  ADMIN_DASHBOARD_SCREEN,
  adminScopedQueryKey,
} from "@/views/admin/views/core/shared/admin-scope";

export const SIGN_UP_RANGES = [7, 14, 30] as const;

export type SignUpRange = (typeof SIGN_UP_RANGES)[number];

export type AdminSignUps = z.infer<typeof zodSignUps>;

export const fetchSignUps = async (
  days: SignUpRange,
): Promise<AdminSignUps> => {
  const response = await fetcher({
    plugin: manifest.id,
    args: { query: { days: String(days) as "7" | "14" | "30" } },
    method: "get",
    module: "admin/users",
    path: "/sign-ups",
  });

  if (!response.ok) {
    throw new AdminRequestError(response.status, "the sign-ups");
  }

  return await response.json();
};

export const signUpsQueryOptions = ({
  adminUserId,
  days,
}: {
  adminUserId: AdminIdentity;
  days: SignUpRange;
}) =>
  queryOptions({
    queryFn: async () => await fetchSignUps(days),
    queryKey: adminScopedQueryKey(
      ADMIN_DASHBOARD_SCREEN,
      adminUserId,
      "sign-ups",
      days,
    ),
    retry: false,
    staleTime: OPERATIONAL_STALE_TIME,
  });
