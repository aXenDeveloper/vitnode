"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import React from "react";
import { useDebouncedCallback } from "use-debounce";

import { usePathname, useRouter } from "@/lib/navigation";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "../ui/input-group";
import { Spinner } from "../ui/spinner";

export function SearchDataTable({
  searchPlaceholder,
}: {
  searchPlaceholder?: string;
}) {
  const t = useTranslations("core.global");
  const searchParams = useSearchParams();
  const searchValue = searchParams.get("search") ?? "";
  const [value, setValue] = React.useState(searchValue);
  const [prevSearchValue, setPrevSearchValue] = React.useState(searchValue);
  const [isPending, startTransition] = React.useTransition();
  const pathname = usePathname();
  const { push } = useRouter();

  if (searchValue !== prevSearchValue) {
    setPrevSearchValue(searchValue);
    setValue(searchValue);
  }

  const handleChangeSearch = useDebouncedCallback((value: string) => {
    startTransition(() => {
      if (value.length < 3 && value.length > 0) {
        return;
      }
      const params = new URLSearchParams(searchParams.toString());

      if (value) {
        params.set("search", value);
      } else {
        params.delete("search");
      }

      push(`${pathname}?${params.toString()}`);
    });
  }, 500);

  return (
    <InputGroup>
      <InputGroupInput
        onChange={e => {
          setValue(e.target.value);
          handleChangeSearch(e.target.value);
        }}
        placeholder={searchPlaceholder ?? t("search_placeholder")}
        value={value}
      />
      <InputGroupAddon>{isPending ? <Spinner /> : <Search />}</InputGroupAddon>
    </InputGroup>
  );
}
