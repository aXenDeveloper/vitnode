import type { AnyContentTypeDefinition } from "@/content/types";
import type {
  AdminTableContract,
  AdminTableParams,
} from "@/views/admin/table/params";

import { CONTENT_DEFAULT_PAGE_SIZE } from "@/content/const";
import { contentFilterableFields, orderableColumns } from "@/content/registry";

import type {
  AdminTableRouteSearch,
  UncheckedAdminTableSearch,
} from "../table-search";

import {
  adminTableRouteParams,
  adminTableSearchParams,
  normalizeAdminTableSearch,
} from "../table-search";

/**
 * The Content Engine list's URL contract.
 *
 * The shared admin-table one, plus the two things a content list has that the
 * four fixed admin tables do not: its sortable columns and its filters are
 * **derived from the content type**, not declared by the screen. So the contract
 * is a function of a definition rather than a constant, and everything below
 * takes one.
 *
 *     ?cursor= ?first= ?last= ?order= ?orderBy= ?search=   the shared contract
 *     ?status= ?categoryId= ?authorId= …                   this type's filters
 *
 * ## The filters are part of the contract because they always were
 *
 * The Next.js list passes its whole `searchParams` object to the generated
 * route, which parses it against a non-strict filter schema. So
 * `?categoryId=3` filters today - there is no UI for it, but a hand-written or
 * pasted URL does it - and dropping it here would be a silent behaviour change
 * for anybody who has one bookmarked.
 *
 * Reproducing it means naming the same keys the schema does, which is what
 * `contentFilterableFields` is for. Keys outside that set are not carried: a
 * stray `?tab=2` reaches neither the URL the controls rebuild nor the cache key,
 * exactly as `rawParamsOf` refuses one for the shared parameters.
 *
 * ## The viewing locale is not in here
 *
 * A localized list is read *in* a language, and that language is the
 * administrator's own - the AdminCP locale cookie, resolved by the root route.
 * It is not a filter, it never appears in the URL, and the API is explicit that
 * it does not hide records a translator has not reached. It is attached to the
 * request by `./query`, which knows the locale; a URL contract has no business
 * with it.
 */

/** The filters one content type accepts, as `field -> value`. */
export type ContentListFilters = Record<string, string>;

/** The normalised request a content list URL is asking for. */
export interface ContentListParams extends AdminTableParams {
  filters: ContentListFilters;
}

export type ContentListRouteSearch = AdminTableRouteSearch &
  Record<string, unknown>;

export type UncheckedContentListSearch = UncheckedAdminTableSearch;

/**
 * The shared half of one content type's contract.
 *
 * `search` is on only when the content type declared searchable fields, matching
 * the Next.js list - which renders the search box on the same condition. A
 * `?search=` sent to a type with none is dropped rather than passed on, so it
 * cannot become a second cache entry holding identical rows.
 */
export const contentTableContract = (
  definition: AnyContentTypeDefinition,
): AdminTableContract => ({
  /**
   * The generated list route's own default, not the data table's.
   *
   * `DEFAULT_TABLE_PAGE_SIZE` is 10 and `CONTENT_DEFAULT_PAGE_SIZE` is 25, and
   * the Next.js list sends neither - it passes its `searchParams` through, so a
   * URL with no `first` gets the API's 25. Taking the table's default here would
   * quietly change every content list to 10 rows, and taking it in only one of
   * the two places would make `?first=25` and no `first` two cache entries.
   */
  defaultPageSize: CONTENT_DEFAULT_PAGE_SIZE,
  orderBy: orderableColumns(definition),
  search: definition.admin.list.searchableFields.length > 0,
});

/**
 * One search parameter as the string it was in the query string.
 *
 * The same narrowing `table-search.ts` applies, and for the same reason: the
 * router's default parser JSON-parses every value, so `?first=20` arrives as a
 * number and a repeated key as an array. Anything that is not a scalar - an
 * object, a nested array, a `null` - is *absent* rather than coerced.
 */
const readParam = (value: unknown): string | undefined => {
  const one = Array.isArray(value) ? (value[0] as unknown) : value;

  if (typeof one === "string") return one;
  if (typeof one === "number") {
    return Number.isFinite(one) ? String(one) : undefined;
  }
  if (typeof one === "boolean") return String(one);

  return undefined;
};

/**
 * The filters this URL is asking for, reduced to the ones the type accepts.
 *
 * Sorted by key, so two URLs naming the same filters in different orders are one
 * cache entry rather than two holding identical rows. Blank values are dropped
 * for the same reason a blank search is: the route treats them as no filter.
 */
export const contentListFilters = (
  input: UncheckedContentListSearch,
  definition: AnyContentTypeDefinition,
): ContentListFilters => {
  const source = input as Record<string, unknown>;

  return Object.fromEntries(
    contentFilterableFields(definition)
      .map(name => [name, readParam(source[name])?.trim() ?? ""] as const)
      .filter(([, value]) => value !== "")
      .sort(([a], [b]) => a.localeCompare(b)),
  );
};

/** The request this URL is asking for - and therefore the cache key. */
export const contentListRouteParams = (
  input: UncheckedContentListSearch,
  definition: AnyContentTypeDefinition,
): ContentListParams => ({
  ...adminTableRouteParams(input, contentTableContract(definition)),
  filters: contentListFilters(input, definition),
});

/**
 * One content list URL in its canonical form: normalised, never rejected.
 *
 * A content list URL is edited by hand and pasted between people, so
 * `?orderBy=password`, `?first=5000` and `?categoryId=` should all produce the
 * table the administrator would otherwise have got - never an error.
 *
 * Total and idempotent, and both are load-bearing where it is used:
 * {@link contentListSearchFrom} runs it on every table navigation to turn a
 * control's new query string back into route search, and the router then
 * validates the location that produces.
 *
 * ## It is deliberately *not* the route's `validateSearch`
 *
 * It cannot be. `validateSearch` is handed the query string alone - never the
 * path params - so it has no way to know which content type this URL is for,
 * and every rule below is a function of that content type's sortable columns
 * and filters. So the route passes its search through untouched and normalises
 * in the loader, where the splat has just resolved; see the note on
 * `loadContentAdminRoute`. The consequence is small and intended: a hand-typed
 * `?orderBy=nonsense` stays in the address bar and renders the default table,
 * and the first control anybody touches rewrites the URL through this.
 */
export const normalizeContentListSearch = (
  input: UncheckedContentListSearch,
  definition: AnyContentTypeDefinition,
): ContentListRouteSearch => ({
  ...normalizeAdminTableSearch(input, contentTableContract(definition)),
  ...contentListFilters(input, definition),
});

/** The query string the table's own controls read themselves out of. */
export const contentListSearchParams = (
  input: UncheckedContentListSearch,
  definition: AnyContentTypeDefinition,
): URLSearchParams => {
  const params = adminTableSearchParams(
    input,
    contentTableContract(definition),
  );

  for (const [key, value] of Object.entries(
    contentListFilters(input, definition),
  )) {
    params.set(key, value);
  }

  return params;
};

/**
 * A query string one of those controls produced, back as route search.
 *
 * The return leg, and the point at which the table's own URL arithmetic is
 * re-validated: a control cannot write a sort column this content type does not
 * have, because what it wrote goes through the same normaliser the address bar
 * would have gone through.
 *
 * Literally that normaliser, rather than the same steps written out again.
 * `adminTableSearchFrom` is `normalizeAdminTableSearch` over the parsed query
 * string, so composing it with the filters a second time produced an identical
 * result by coincidence rather than by construction - and a rule added to
 * {@link normalizeContentListSearch} would have reached the address bar and not
 * the controls.
 */
export const contentListSearchFrom = (
  nextSearch: string,
  definition: AnyContentTypeDefinition,
): ContentListRouteSearch =>
  normalizeContentListSearch(
    Object.fromEntries(new URLSearchParams(nextSearch)),
    definition,
  );

/**
 * The request, flattened for the wire.
 *
 * The filters sit beside the pagination parameters in one query string, which is
 * what the generated route reads: `paginationQuery.extend(filters.shape)` parses
 * the whole thing at once.
 */
export const contentListQuery = (
  params: ContentListParams,
): Record<string, string | undefined> => {
  const { filters, ...table } = params;

  return { ...filters, ...table };
};
