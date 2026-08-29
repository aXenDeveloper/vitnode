"use client";

import { Search } from "lucide-react";
import React from "react";
import { useDebouncedCallback } from "use-debounce";
import { useTranslations } from "use-intl";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "../ui/input-group";
import { Spinner } from "../ui/spinner";
import { useDataTableUrl } from "./navigation";
import { readTableSearch, withTableSearch } from "./url-state";

export function SearchDataTable({
  searchPlaceholder,
}: {
  searchPlaceholder?: string;
}) {
  const t = useTranslations("core.global");
  const { isPending, navigate, searchParams } = useDataTableUrl();
  const searchValue = readTableSearch(searchParams);
  const [value, setValue] = React.useState(searchValue);
  const [prevSearchValue, setPrevSearchValue] = React.useState(searchValue);

  if (searchValue !== prevSearchValue) {
    setPrevSearchValue(searchValue);
    setValue(searchValue);
  }

  const handleChangeSearch = useDebouncedCallback((value: string) => {
    navigate(withTableSearch(searchParams, value));
  }, 500);

  return (
    <InputGroup>
      <InputGroupInput
        onChange={e => {
          setValue(e.target.value);
          handleChangeSearch(e.target.value);
        }}
        placeholder={searchPlaceholder ?? t("search_placeholder")}
        type="search"
        value={value}
      />
      <InputGroupAddon>{isPending ? <Spinner /> : <Search />}</InputGroupAddon>
    </InputGroup>
  );
}
