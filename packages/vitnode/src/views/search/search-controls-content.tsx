"use client";

import { SearchIcon } from "lucide-react";
import React from "react";
import { useDebouncedCallback } from "use-debounce";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";

import type {
  SearchFeedLinkComponent,
  SearchFeedVariant,
} from "./search-feed-content";
import type {
  SearchFeedParams,
  SearchFeedQueryOptions,
} from "./search-feed-query";
import type { SearchSort } from "./search-params";

import { getSearchTypeRenderer, searchTypeKeys } from "./registry";
import { SearchFeedContent } from "./search-feed-content";
import {
  appliedSearchTerm,
  defaultSearchSort,
  parseSearchTypes,
  SEARCH_SORT_VALUES,
  SEARCH_TERM_DEBOUNCE_MS,
  searchFeedParamsFor,
  sortForAppliedTerm,
} from "./search-params";

/**
 * The search feed a set of controls is currently asking for.
 *
 * A factory rather than a finished options object, because the controls are what
 * *changes* the request: the visitor types, toggles a type or picks a sort, and
 * the feed has to become a different query. So the caller supplies the one thing
 * only it knows - how a page is fetched in this app - and the controls supply the
 * parameters.
 *
 * Both frameworks build it from the same `searchFeedQueryOptions`, so the query
 * key, the cursor rule, the response check and the paging behaviour are the
 * feed's, not this component's. See {@link SearchControlsContent}.
 */
export type SearchFeedQueryFactory = (
  params: SearchFeedParams,
) => SearchFeedQueryOptions;

/**
 * The search page's controls and its results, with nothing framework-shaped in
 * them.
 *
 * This is the whole of the search *interaction* - the debounced term, the type
 * filters, the sort, and the feed underneath - and it runs unchanged under
 * Next.js and under TanStack Start. Exactly two things are injected, and they
 * are the same two {@link SearchFeedContent} already needed:
 *
 * - **`feedQuery`.** See {@link SearchFeedQueryFactory}. The transport is the
 *   only part of a feed that genuinely differs between a server rendering a
 *   request and a browser, so it is the only part that crosses this boundary.
 * - **`LinkComponent`.** A search hit points wherever the indexed content lives,
 *   and turning that into a client-side navigation is the router's job.
 *
 * Translations come from `use-intl` directly - the framework-free half of
 * `next-intl`, and the same instance `NextIntlClientProvider` provides into - so
 * the Next.js app needs no extra provider for this to work.
 *
 * ## The URL is deliberately not written to
 *
 * The term, the types and the sort are component state. Only the *initial* term
 * comes from outside, as `defaultParams`, which is how the page has always
 * worked: `/search?search=hello` opens on a search for "hello" and everything
 * after that is local. A route that wants the URL to follow the controls has to
 * decide what a shareable search URL is - which sort belongs in it, whether every
 * keystroke is a history entry - and that is a product question, not a migration
 * one.
 */
export const SearchControlsContent = ({
  LinkComponent,
  defaultParams,
  feedQuery,
  variant = "timeline",
}: {
  defaultParams: SearchFeedParams;
  feedQuery: SearchFeedQueryFactory;
  LinkComponent: SearchFeedLinkComponent;
  variant?: SearchFeedVariant;
}) => {
  const t = useTranslations("core.search");
  const [term, setTerm] = React.useState(defaultParams.search ?? "");
  const [appliedTerm, setAppliedTerm] = React.useState(
    defaultParams.search ?? "",
  );
  const [types, setTypes] = React.useState<string[]>(() =>
    parseSearchTypes(defaultParams.types),
  );
  const [sort, setSort] = React.useState<SearchSort>(
    () => defaultParams.sort ?? defaultSearchSort(defaultParams.search),
  );

  /**
   * The searched-for term, a moment after the visitor stops typing.
   *
   * `appliedSearchTerm` owns the decision - including "do nothing", which is
   * what a one- or two-character term gets - so this only has to act on it. A
   * term that *is* applied also moves the sort off the browse default, and only
   * off that one: see `sortForAppliedTerm`.
   */
  const applyTerm = useDebouncedCallback((value: string) => {
    const next = appliedSearchTerm(value);

    if (next === null) return;

    setAppliedTerm(next);
    if (next.length > 0) setSort(sortForAppliedTerm);
  }, SEARCH_TERM_DEBOUNCE_MS);

  const toggleType = (key: string) => {
    setTypes(prev =>
      prev.includes(key) ? prev.filter(item => item !== key) : [...prev, key],
    );
  };

  /**
   * Rebuilt on every render, deliberately: it is derived from state that changes
   * as the visitor types, so memoising on it would be memoising on a moving
   * value. Query hashes keys structurally, so an equal object is the same cache
   * entry.
   */
  const params = searchFeedParamsFor({ search: appliedTerm, sort, types });

  return (
    <div className="flex flex-col gap-4">
      <InputGroup>
        <InputGroupInput
          aria-label={t("placeholder")}
          onChange={e => {
            setTerm(e.target.value);
            applyTerm(e.target.value);
          }}
          placeholder={t("placeholder")}
          type="search"
          value={term}
        />
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
      </InputGroup>

      <div className="flex flex-wrap items-center gap-2">
        {searchTypeKeys.map(key => (
          <Button
            aria-pressed={types.includes(key)}
            key={key}
            onClick={() => toggleType(key)}
            size="sm"
            variant={types.includes(key) ? "default" : "outline"}
          >
            {t(getSearchTypeRenderer(key).labelKey)}
          </Button>
        ))}

        <NativeSelect
          aria-label={t("sortBy")}
          className="ms-auto"
          onChange={e => setSort(e.target.value as SearchSort)}
          size="sm"
          value={sort}
        >
          {SEARCH_SORT_VALUES.map(value => (
            <NativeSelectOption key={value} value={value}>
              {t(`sort.${value}`)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <SearchFeedContent
        LinkComponent={LinkComponent}
        queryOptions={feedQuery(params)}
        variant={variant}
      />
    </div>
  );
};
