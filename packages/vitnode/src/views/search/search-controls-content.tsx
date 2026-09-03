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

export type SearchFeedQueryFactory = (
  params: SearchFeedParams,
) => SearchFeedQueryOptions;

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
