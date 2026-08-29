import type {
  MyFilesOrder,
  MyFilesOrderBy,
  MyFilesParams,
  RawMyFilesParams,
} from "@/views/files/my-files-query";

import { DEFAULT_TABLE_PAGE_SIZE } from "@/components/table/url-state";
import { normalizeMyFilesParams } from "@/views/files/my-files-query";

/**
 * What a `/files` route reads out of its URL, and the three things it turns that
 * into.
 *
 * Four pure functions, no transport and no React, so the route's contract can be
 * stated and tested without a router - `route-search.test.ts` beside this file
 * is the whole of it. The same split `/search` uses (`../search/route-search`),
 * applied to a table instead of a feed.
 *
 * Every one of them delegates the *meaning* of a parameter to
 * `@/views/files/my-files-query`, which is the module the Next.js
 * `MyFilesTableView` reads its `searchParams` through. So `/files?orderBy=name`
 * is the same request in both applications rather than two hand-written
 * approximations of it, and nothing here re-states which columns are sortable or
 * how large a page may be.
 *
 * ## Three shapes, and why they are not one
 *
 *     the URL       ?orderBy=name&first=20     what a visitor sees and shares
 *     the search    { orderBy: 'name', first: 20 }   the route's validated state
 *     the request   { first: '20', orderBy: 'name' } what the API is asked for
 *
 * The middle one is the URL, validated. The last one is `MyFilesParams`, which
 * additionally *always* names a page size, because a request must - and a URL
 * need not. Keeping them apart is what stops `?first=10` being written into
 * every link to a page whose canonical address is `/files`.
 *
 * ## All four are total and idempotent
 *
 * None of them can throw and none of them reject: a URL typed by hand renders
 * the table it would have rendered anyway. That is not politeness, it is a
 * requirement of where they run - `validateSearch` throwing turns a hand-edited
 * query string into a router error screen, and this page's query string is
 * edited by hand every time somebody shares a sorted link.
 *
 * Idempotent because they are applied twice on every navigation: once when a
 * table control's new query string is turned back into route search, and once
 * more by the router when it validates the location that produces. A rule that
 * moved the value on the second pass would make the table drift a step per
 * click.
 */

/**
 * The page size the URL does not need to mention.
 *
 * `DEFAULT_TABLE_PAGE_SIZE` is what every `DataTable` falls back to when the URL
 * asks for no size, so `?first=10` and no `first` at all are the same request
 * spelled two ways - and the shorter spelling is the one this route settles on.
 */
const DEFAULT_PAGE_SIZE = String(DEFAULT_TABLE_PAGE_SIZE);

/**
 * The route's validated search - the URL contract, and nothing else.
 *
 * Exactly the six parameters `DataTable`'s controls write: the sort header emits
 * `orderBy`/`order`, the search box `search`, and the pager `first`/`last` with
 * a `cursor`. There is no seventh, because this table declares no filters.
 *
 * `first` and `last` are numbers rather than strings, and that is about the
 * address bar rather than about types. TanStack Router's default search
 * serializer JSON-encodes a *string* that would parse as JSON, so the string
 * `'20'` is written to the URL as `first=%2220%22`; the number `20` is written
 * as `first=20`, which is what the Next.js page produces and what the API reads.
 */
export interface MyFilesRouteSearch {
  cursor?: string;
  first?: number;
  last?: number;
  order?: MyFilesOrder;
  orderBy?: MyFilesOrderBy;
  search?: string;
}

/**
 * A search as it arrives, before anything has checked it.
 *
 * Two shapes, because there are two callers and they are genuinely different.
 * The router hands over its *parsed* search - an arbitrary bag of whatever was
 * in the query string - and the route hands its own validated search straight
 * back in, on every navigation and in the idempotence assertions. An `interface`
 * has no implicit index signature, so the second is not assignable to the first
 * and the union has to say so.
 */
export type UncheckedMyFilesSearch =
  MyFilesRouteSearch | Record<string, unknown>;

/**
 * One search parameter as the string it was in the query string.
 *
 * The router hands `validateSearch` its *parsed* search, and the default parser
 * JSON-parses every value - so `?first=20` arrives as the number `20`, `?x=true`
 * as a boolean, and a repeated key as an array. The normaliser is written
 * against a query string, where everything is a string, and one of its rules
 * (`search.trim()`) throws on anything else.
 *
 * So this is the seam between the two, and it is deliberately narrow: scalars
 * become their string spelling, the first entry of an array wins because only
 * one value can reach the API, and everything else - an object, a nested array,
 * a `null` - is *absent* rather than coerced. `String({})` is
 * `"[object Object]"`, which is a value no rule below would recognise but every
 * rule would have to consider.
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
 * The six parameters this route has, in the shape the normaliser reads.
 *
 * Named one by one rather than passed through, which is the whole of rule 3:
 * nothing a visitor puts in the query string reaches the request builder unless
 * this route asked for it. A stray `?tab=2` is not carried, not validated, and
 * not sent.
 */
const rawParamsOf = (input: UncheckedMyFilesSearch): RawMyFilesParams => ({
  cursor: readParam(input.cursor),
  first: readParam(input.first),
  last: readParam(input.last),
  order: readParam(input.order),
  orderBy: readParam(input.orderBy),
  search: readParam(input.search),
});

/**
 * The request this URL is asking for - `MyFilesParams`, and therefore also the
 * object the query key is built from.
 *
 * Every defaulting and clamping rule is `normalizeMyFilesParams`': an unusable
 * page size falls back rather than 400ing, `first` beats `last`, a sort column
 * the list cannot sort by is dropped so the API applies its own `createdAt
 * desc`, a blank search is no search, and a cursor that cannot be one is not
 * sent.
 *
 * Takes the loose object rather than {@link MyFilesRouteSearch} on purpose. The
 * router merges a route's validated search over the *raw* parsed one, so
 * `Route.useSearch()` still carries whatever else was in the query string; going
 * back through the same normalisation is what makes this answer depend only on
 * the six parameters above, whoever is calling it.
 */
export const myFilesRouteParams = (
  input: UncheckedMyFilesSearch,
): MyFilesParams => normalizeMyFilesParams(rawParamsOf(input));

/**
 * The route's search schema - written as a function rather than a schema object
 * because its job is to *normalise*, not to reject.
 *
 * `/files` is a page whose query string is edited by hand and pasted between
 * people: `?orderBy=password`, `?first=5000`, `?first=abc`, `?cursor=💥`. Every
 * one of them should render the visitor's files sorted the way the table
 * defaults to, not a router error - so an unusable value becomes an absent one,
 * and the API's own `createdAt desc` is what an unrecognised `orderBy` falls
 * back to.
 *
 * The one thing it does *not* keep is a page size equal to the default. `/files`
 * and `/files?first=10` are the same page, and a schema that answered
 * `first: 10` for the first of them would write `?first=10` into every link the
 * router builds to this route - including the one a migration link renders and
 * the one a guest's `?returnTo=` comes back through.
 */
export const normalizeMyFilesRouteSearch = (
  input: UncheckedMyFilesSearch,
): MyFilesRouteSearch => {
  const { cursor, first, last, order, orderBy, search } =
    myFilesRouteParams(input);

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
  };
};

/**
 * The query string the table's controls read themselves out of.
 *
 * `DataTable`'s sort headers, pager and search box are handed a
 * `URLSearchParams` and produce a new query string from it
 * (`components/table/url-state.ts`); this is the other end of that, and it is
 * built from the validated search rather than from the address bar so a control
 * can only ever edit a parameter this route recognises.
 */
export const myFilesSearchParams = (
  input: UncheckedMyFilesSearch,
): URLSearchParams => {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(
    normalizeMyFilesRouteSearch(input),
  )) {
    params.set(key, String(value));
  }

  return params;
};

/**
 * A query string one of those controls produced, back as route search.
 *
 * The return leg, and the point at which the table's own URL arithmetic is
 * re-validated: a control cannot write a sort column this route does not have,
 * because what it wrote goes through the same schema the address bar does.
 */
export const myFilesSearchFrom = (nextSearch: string): MyFilesRouteSearch =>
  normalizeMyFilesRouteSearch(
    Object.fromEntries(new URLSearchParams(nextSearch)),
  );
