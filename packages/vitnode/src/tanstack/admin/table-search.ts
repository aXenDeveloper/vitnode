import type {
  AdminTableContract,
  AdminTableOrder,
  AdminTableParams,
  RawAdminTableParams,
} from "@/views/admin/table/params";

import { DEFAULT_TABLE_PAGE_SIZE } from "@/components/table/url-state";
import { normalizeAdminTableParams } from "@/views/admin/table/params";

/**
 * The URL contract every AdminCP list route shares, as four pure functions.
 *
 * `tanstack/files/route-search.ts` is the same shape written for one screen;
 * this is it written once for the four admin tables, because they differ only in
 * the {@link AdminTableContract} they declare. No transport and no React, so
 * what `?orderBy=name` means can be stated and tested without a router -
 * `table-search.test.ts` beside this file is the whole of it.
 *
 * ## Three shapes, and why they are not one
 *
 *     the URL       ?orderBy=name&first=20            what an admin sees and shares
 *     the search    { orderBy: 'name', first: 20 }    the route's validated state
 *     the request   { first: '20', orderBy: 'name' }  what the API is asked for
 *
 * The middle one is the URL, validated. The last one is {@link AdminTableParams},
 * which *always* names a page size, because a request must and a URL need not.
 * Keeping them apart is what stops `?first=10` being written into every link to
 * a page whose canonical address has no query string at all.
 */

/**
 * The page size the URL does not need to mention.
 *
 * `DEFAULT_TABLE_PAGE_SIZE` is what every `DataTable` falls back to, and what
 * the Next.js fetcher's `withPagination` writes, so `?first=10` and no `first`
 * are the same request spelled two ways - and the shorter spelling is the one
 * these routes settle on.
 */
const DEFAULT_PAGE_SIZE = String(DEFAULT_TABLE_PAGE_SIZE);

/**
 * A route's validated search - the URL contract, and nothing else.
 *
 * `first` and `last` are numbers rather than strings, and that is about the
 * address bar rather than about types. TanStack Router's default search
 * serializer JSON-encodes a *string* that would parse as JSON, so `'20'` is
 * written to the URL as `first=%2220%22`; the number `20` is written as
 * `first=20`, which is what the Next.js page produces and what the API reads.
 */
export interface AdminTableRouteSearch<TOrderBy extends string = string> {
  cursor?: string;
  first?: number;
  last?: number;
  order?: AdminTableOrder;
  orderBy?: TOrderBy;
  search?: string;
  status?: string;
}

/**
 * A search as it arrives, before anything has checked it.
 *
 * Two shapes, because there are two callers and they are genuinely different.
 * The router hands over its *parsed* search - an arbitrary bag of whatever was
 * in the query string - and the route hands its own validated search straight
 * back in, on every navigation. An `interface` has no implicit index signature,
 * so the second is not assignable to the first and the union has to say so.
 */
export type UncheckedAdminTableSearch<TOrderBy extends string = string> =
  AdminTableRouteSearch<TOrderBy> | Record<string, unknown>;

/**
 * One search parameter as the string it was in the query string.
 *
 * The router hands `validateSearch` its *parsed* search, and the default parser
 * JSON-parses every value - so `?first=20` arrives as the number `20`, `?x=true`
 * as a boolean, and a repeated key as an array. The normaliser is written
 * against a query string, where everything is a string.
 *
 * Deliberately narrow: scalars become their string spelling, the first entry of
 * an array wins because only one value can reach the API, and everything else -
 * an object, a nested array, a `null` - is *absent* rather than coerced.
 * `String({})` is `"[object Object]"`, which no rule below would recognise but
 * every rule would have to consider.
 */
const readParam = (value: unknown): string | undefined => {
  const one = Array.isArray(value) ? (value[0] as unknown) : value;

  if (typeof one === "string") return one;
  if (typeof one === "number")
    return Number.isFinite(one) ? String(one) : undefined;
  if (typeof one === "boolean") return String(one);

  return undefined;
};

/**
 * The parameters these routes have, in the shape the normaliser reads.
 *
 * Named one by one rather than passed through: nothing an administrator puts in
 * the query string reaches the request builder unless the contract asked for it,
 * so a stray `?tab=2` is not carried, not validated and not sent.
 */
const rawParamsOf = (
  input: UncheckedAdminTableSearch,
): RawAdminTableParams => ({
  cursor: readParam(input.cursor),
  first: readParam(input.first),
  last: readParam(input.last),
  order: readParam(input.order),
  orderBy: readParam(input.orderBy),
  search: readParam(input.search),
  status: readParam(input.status),
});

/**
 * The request this URL is asking for - and therefore the object the query key is
 * built from.
 *
 * Takes the loose object rather than {@link AdminTableRouteSearch} on purpose.
 * The router merges a route's validated search over the *raw* parsed one, so
 * `Route.useSearch()` still carries whatever else was in the query string; going
 * back through the same normalisation is what makes this answer depend only on
 * the parameters the contract names, whoever is calling it.
 */
export const adminTableRouteParams = <TOrderBy extends string>(
  input: UncheckedAdminTableSearch<TOrderBy>,
  contract: AdminTableContract<TOrderBy>,
): AdminTableParams<TOrderBy> =>
  normalizeAdminTableParams(rawParamsOf(input), contract);

/**
 * The route's search schema - written as a function rather than a schema object
 * because its job is to *normalise*, not to reject.
 *
 * An AdminCP list URL is edited by hand and pasted between people:
 * `?orderBy=password`, `?first=5000`, `?first=abc`, `?cursor=💥`. Every one of
 * them should render the table the way it defaults to, not a router error.
 *
 * The one thing it does *not* keep is a page size equal to the default.
 * `/admin/core/advanced/cron` and `/admin/core/advanced/cron?first=10` are the
 * same page, and a schema that answered `first: 10` for the first of them would
 * write `?first=10` into every link the router builds to that route - including
 * the sidebar's.
 */
export const normalizeAdminTableSearch = <TOrderBy extends string>(
  input: UncheckedAdminTableSearch<TOrderBy>,
  contract: AdminTableContract<TOrderBy>,
): AdminTableRouteSearch<TOrderBy> => {
  const { cursor, first, last, order, orderBy, search, status } =
    adminTableRouteParams(input, contract);

  return {
    ...(cursor === undefined ? {} : { cursor }),
    // See above: the default page size is the URL saying nothing.
    ...(first === undefined || first === DEFAULT_PAGE_SIZE
      ? {}
      : { first: Number(first) }),
    // `last` is never dropped: paging *backwards* at the default size is a
    // different request from not paging at all, and the parameter is what says
    // so.
    ...(last === undefined ? {} : { last: Number(last) }),
    ...(order === undefined ? {} : { order }),
    ...(orderBy === undefined ? {} : { orderBy }),
    ...(search === undefined ? {} : { search }),
    ...(status === undefined ? {} : { status }),
  };
};

/**
 * The query string the table's controls read themselves out of.
 *
 * `DataTable`'s sort headers, pager, search box and filters are handed a
 * `URLSearchParams` and produce a new query string from it
 * (`components/table/url-state.ts`); this is the other end of that, and it is
 * built from the validated search rather than from the address bar so a control
 * can only ever edit a parameter the route recognises.
 */
export const adminTableSearchParams = <TOrderBy extends string>(
  input: UncheckedAdminTableSearch<TOrderBy>,
  contract: AdminTableContract<TOrderBy>,
): URLSearchParams => {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(
    normalizeAdminTableSearch(input, contract),
  )) {
    params.set(key, String(value));
  }

  return params;
};

/**
 * A query string one of those controls produced, back as route search.
 *
 * The return leg, and the point at which the table's own URL arithmetic is
 * re-validated: a control cannot write a sort column the route does not have,
 * because what it wrote goes through the same schema the address bar does.
 */
export const adminTableSearchFrom = <TOrderBy extends string>(
  nextSearch: string,
  contract: AdminTableContract<TOrderBy>,
): AdminTableRouteSearch<TOrderBy> =>
  normalizeAdminTableSearch(
    Object.fromEntries(new URLSearchParams(nextSearch)),
    contract,
  );

export type { AdminTableContract, AdminTableOrder, AdminTableParams };

/**
 * How a table control changes the URL - the one thing the shared table cannot
 * decide for itself.
 *
 * `DataTable` mounts this for Next.js (`NextDataTableNavigation`, a locale-aware
 * `push`); a TanStack route mounts it with its own router's navigate.
 * Everything either side of it - which parameter a sort header rewrites, which
 * ones a filter resets, what a page button does with a cursor - is
 * `components/table/url-state.ts` and is shared.
 *
 * `to` is deliberately absent: with no destination the router stays on the
 * current route and changes only its search, which is the whole of what a table
 * control does. The promise is returned rather than dropped so the seam's
 * `useTransition` stays pending for the whole navigation, which is what keeps
 * the current rows on screen with a spinner instead of blanking the table.
 *
 * Generic over the route's *search* type rather than over its sortable columns,
 * so a screen names the type it already has (`CronRouteSearch`) rather than
 * restating its `orderBy` union.
 */
export type AdminTableNavigate<TSearch> = (options: {
  resetScroll: boolean;
  search: TSearch;
}) => Promise<void>;
