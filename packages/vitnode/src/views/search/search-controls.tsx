"use client";

import { SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import React from "react";
import { useDebouncedCallback } from "use-debounce";

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

import type { SearchFeedParams } from "./search-feed";
import type { SearchFeedPage } from "./types";

import { getSearchTypeRenderer, searchTypeKeys } from "./registry";
import { SearchFeed } from "./search-feed";

type SortValue = "newest" | "oldest" | "relevance";

const SORT_VALUES: SortValue[] = ["relevance", "newest", "oldest"];
const MIN_TERM_LENGTH = 3;

export const SearchControls = ({
  defaultParams,
  initialData,
}: {
  defaultParams: SearchFeedParams;
  initialData?: SearchFeedPage;
}) => {
  const t = useTranslations("core.search");
  const [term, setTerm] = React.useState(defaultParams.search ?? "");
  const [appliedTerm, setAppliedTerm] = React.useState(
    defaultParams.search ?? "",
  );
  const [types, setTypes] = React.useState<string[]>(
    defaultParams.types ? defaultParams.types.split(",") : [],
  );
  const [sort, setSort] = React.useState<SortValue>(
    defaultParams.sort ?? "newest",
  );

  const applyTerm = useDebouncedCallback((value: string) => {
    if (value.length >= MIN_TERM_LENGTH) {
      setAppliedTerm(value);
      setSort(prev => (prev === "newest" ? "relevance" : prev));
    } else if (value.length === 0) {
      setAppliedTerm("");
    }
  }, 500);

  const toggleType = (key: string) => {
    setTypes(prev =>
      prev.includes(key) ? prev.filter(item => item !== key) : [...prev, key],
    );
  };

  const params: SearchFeedParams = {
    search: appliedTerm || undefined,
    types: types.length ? types.join(",") : undefined,
    sort,
  };

  return (
    <div className="flex flex-col gap-4">
      <InputGroup>
        <InputGroupInput
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
            key={key}
            onClick={() => toggleType(key)}
            size="sm"
            variant={types.includes(key) ? "default" : "outline"}
          >
            {t(getSearchTypeRenderer(key).labelKey)}
          </Button>
        ))}

        <NativeSelect
          className="ms-auto"
          onChange={e => setSort(e.target.value as SortValue)}
          size="sm"
          value={sort}
        >
          {SORT_VALUES.map(value => (
            <NativeSelectOption key={value} value={value}>
              {t(`sort.${value}`)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <SearchFeed initialData={initialData} params={params} variant="timeline" />
    </div>
  );
};
