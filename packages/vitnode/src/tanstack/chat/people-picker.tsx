import type { ContentPublicPerson } from "@vitnode/api/content/public-person";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { SearchIcon, XIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";

import { chatRoot, searchChatPeople } from "./query";

const useDebounced = <T,>(value: T, delay: number): T => {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [delay, value]);

  return debounced;
};

/** Search members by name and collect them as removable chips. */
export const ChatPeoplePicker = ({
  exclude = [],
  max,
  onChange,
  userId,
  value,
}: {
  /** Ids that can't be picked, such as current members. */
  exclude?: readonly number[];
  /** `null` = no limit. */
  max: null | number;
  onChange: (people: ContentPublicPerson[]) => void;
  userId: number;
  value: ContentPublicPerson[];
}) => {
  const t = useTranslations("core.global.chat.people");
  const inputId = React.useId();
  const listId = React.useId();
  const [q, setQ] = React.useState("");
  const query = useDebounced(q.trim(), 250);
  const results = useQuery({
    enabled: query.length > 0,
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => await searchChatPeople(query, signal),
    queryKey: [...chatRoot(userId), "people", query] as const,
    retry: false,
  });
  const picked = new Set([...value.map(person => person.id), ...exclude]);
  const full = max !== null && value.length >= max;
  const options = (results.data ?? []).filter(person => !picked.has(person.id));

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium" htmlFor={inputId}>
        {t("label")}
      </label>
      {value.length > 0 ? (
        <ul aria-label={t("selected")} className="flex flex-wrap gap-1.5">
          {value.map(person => (
            <li
              className="bg-muted flex items-center gap-1.5 rounded-full py-0.5 ps-0.5 pe-1 text-sm"
              key={person.id}
            >
              <Avatar alt="" size={22} user={person} />
              <span>{person.name}</span>
              <Button
                aria-label={t("remove", { name: person.name })}
                className="size-5"
                onClick={() => {
                  onChange(value.filter(item => item.id !== person.id));
                }}
                size="icon-sm"
                variant="ghost"
              >
                <XIcon aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <InputGroup>
        <InputGroupAddon>
          <SearchIcon aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          aria-controls={listId}
          autoComplete="off"
          disabled={full}
          id={inputId}
          onChange={event => {
            setQ(event.target.value);
          }}
          placeholder={full ? t("full", { max: max ?? 0 }) : t("placeholder")}
          value={q}
        />
      </InputGroup>
      <div aria-busy={results.isFetching} id={listId}>
        {query.length === 0 ? null : results.isPending ? (
          <div className="flex flex-col gap-2 p-1" role="status">
            <span className="sr-only">{t("searching")}</span>
            {Array.from({ length: 2 }, (_, index) => (
              <div className="flex items-center gap-2" key={index}>
                <Skeleton className="size-7 rounded-full" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        ) : results.isError ? (
          <p className="text-destructive p-1 text-sm" role="alert">
            {t("error")}
          </p>
        ) : options.length === 0 ? (
          <p className="text-muted-foreground p-1 text-sm" role="status">
            {t("no_results")}
          </p>
        ) : (
          <ul aria-label={t("results")} className="flex flex-col gap-0.5">
            {options.map(person => (
              <li key={person.id}>
                <button
                  className="hover:bg-muted focus-visible:ring-ring/50 flex w-full items-center gap-2 rounded-md p-1.5 text-start text-sm outline-none focus-visible:ring-3 disabled:opacity-50"
                  disabled={full}
                  onClick={() => {
                    onChange([...value, person]);
                    setQ("");
                  }}
                  type="button"
                >
                  <Avatar alt="" size={28} user={person} />
                  <span className="font-medium">{person.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
