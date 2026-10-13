import type {
  ModcpApprovalsFilter,
  ModcpApprovalStatus,
} from "@/views/moderation/modcp/modcp-query";

import { asSearchValue, readPageSize } from "@/lib/table-params";
import { MODCP_APPROVAL_STATUSES } from "@/views/moderation/modcp/modcp-query";

export const MODCP_APPROVALS_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_PAGE = 10_000;
const MAX_TYPE_LENGTH = 100;

export interface ModcpApprovalsRouteSearch {
  container?: number;
  first?: number;
  page?: number;
  /** `pending` is what the URL says by saying nothing. */
  status?: Exclude<ModcpApprovalStatus, "pending">;
  type?: string;
}

const positiveInt = (raw: string | undefined, max: number) => {
  if (raw === undefined || !/^\d+$/.test(raw)) return undefined;
  const value = Number(raw);

  return Number.isSafeInteger(value) && value > 0 && value <= max
    ? value
    : undefined;
};

const isStatus = (value: string): value is ModcpApprovalStatus =>
  MODCP_APPROVAL_STATUSES.some(status => status === value);

export const normalizeModcpApprovalsSearch = (
  input: Record<string, unknown>,
): ModcpApprovalsRouteSearch => {
  const status = asSearchValue(input.status);
  const type = asSearchValue(input.type)?.trim();
  const container = positiveInt(asSearchValue(input.container), 2_147_483_647);
  const page = positiveInt(asSearchValue(input.page), MAX_PAGE);
  const rawFirst = asSearchValue(input.first);
  const first =
    rawFirst === undefined ? undefined : readPageSize(rawFirst, MAX_PAGE_SIZE);

  return {
    ...(status !== undefined && isStatus(status) && status !== "pending"
      ? { status }
      : {}),
    ...(type && type.length <= MAX_TYPE_LENGTH ? { type } : {}),
    ...(container === undefined ? {} : { container }),
    ...(page === undefined || page === 1 ? {} : { page }),
    ...(first === undefined || Number(first) === MODCP_APPROVALS_PAGE_SIZE
      ? {}
      : { first: Number(first) }),
  };
};

export const modcpApprovalsFilter = (
  search: ModcpApprovalsRouteSearch,
): ModcpApprovalsFilter => ({
  page: search.page ?? 1,
  pageSize: search.first ?? MODCP_APPROVALS_PAGE_SIZE,
  status: search.status ?? "pending",
  ...(search.type === undefined ? {} : { contentTypeId: search.type }),
  ...(search.container === undefined ? {} : { containerId: search.container }),
});

export const modcpApprovalsSearchParams = (
  search: ModcpApprovalsRouteSearch,
): URLSearchParams =>
  new URLSearchParams(
    Object.entries(search)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, String(value)]),
  );

export const modcpApprovalsSearchFrom = (
  query: string,
): ModcpApprovalsRouteSearch =>
  normalizeModcpApprovalsSearch(Object.fromEntries(new URLSearchParams(query)));
