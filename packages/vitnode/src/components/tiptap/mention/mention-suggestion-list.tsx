import type { SuggestionKeyDownProps } from "@tiptap/suggestion";

import { useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { RotateCwIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MentionsRequestError,
  mentionSuggestionsQueryOptions,
} from "@/views/mentions/mentions-query";

import type { MentionCommandProps } from "./mention-suggestion";

import {
  SUGGESTION_POPUP_CLASS,
  useActiveDescendant,
} from "../suggestion-popup";

/** Typing pauses this long before the members are looked up. */
const SEARCH_DELAY_MS = 150;

const SKELETON_ROWS = 3;

const MENTION_MIN_QUERY_LENGTH = 3;

export interface MentionSuggestionListRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

export interface MentionSuggestionListProps {
  command: (props: MentionCommandProps) => void;
  query: string;
  ref?: React.Ref<MentionSuggestionListRef>;
  textbox?: HTMLElement;
}

const useDelayedValue = (value: string, delay: number): string => {
  const [delayed, setDelayed] = React.useState(value);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDelayed(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [delay, value]);

  return delayed;
};

// Keeps the caret in the editor when a click lands on the popup.
const keepEditorFocus = (event: React.MouseEvent) => {
  event.preventDefault();
};

export const MentionSuggestionList = ({
  command,
  query,
  ref,
  textbox,
}: MentionSuggestionListProps) => {
  const t = useTranslations("core.global.editor.mention");
  const term = query.trim();
  const isReady = term.length >= MENTION_MIN_QUERY_LENGTH;
  const search = useDelayedValue(isReady ? term : "", SEARCH_DELAY_MS);
  const suggestions = useQuery(mentionSuggestionsQueryOptions(search));
  const items = React.useMemo(
    () => (isReady && search !== "" ? (suggestions.data ?? []) : []),
    [isReady, search, suggestions.data],
  );
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [renderedItems, setRenderedItems] = React.useState(items);
  const listRef = React.useRef<HTMLDivElement>(null);
  const baseId = React.useId();
  const listId = `${baseId}-list`;
  const optionIdOf = (index: number) => `${baseId}-option-${index}`;

  if (renderedItems !== items) {
    setRenderedItems(items);
    setActiveIndex(0);
  }

  const select = (index: number) => {
    const item = items[index];
    if (!item) return;

    command({ id: item.id, label: item.name, nameCode: item.nameCode });
  };

  React.useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (items.length === 0) return false;

      if (event.key === "ArrowUp") {
        setActiveIndex(current => (current + items.length - 1) % items.length);

        return true;
      }

      if (event.key === "ArrowDown") {
        setActiveIndex(current => (current + 1) % items.length);

        return true;
      }

      if (event.key === "Enter" || event.key === "Tab") {
        select(activeIndex);

        return true;
      }

      return false;
    },
  }));

  useActiveDescendant({
    activeId: items[activeIndex] ? optionIdOf(activeIndex) : undefined,
    listId,
    textbox,
  });

  React.useEffect(() => {
    listRef.current
      ?.querySelector("[data-active='true']")
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!isReady) return null;

  // Waiting for the typing pause or for the first answer.
  if (search === "" || (suggestions.isPending && items.length === 0)) {
    return (
      <div
        aria-busy="true"
        className={cn(SUGGESTION_POPUP_CLASS, "flex flex-col gap-1 p-1")}
      >
        <span className="sr-only" role="status">
          {t("loading")}
        </span>
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <div className="flex items-center gap-2 px-2 py-1.5" key={index}>
            <Skeleton className="size-6 rounded-full" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </div>
    );
  }

  if (suggestions.isError && items.length === 0) {
    const forbidden =
      suggestions.error instanceof MentionsRequestError &&
      suggestions.error.status === 403;

    return (
      <div
        className={cn(
          SUGGESTION_POPUP_CLASS,
          "flex flex-col items-start gap-2 p-3 text-sm",
        )}
        role="alert"
      >
        <p className="text-muted-foreground leading-relaxed text-pretty">
          {forbidden ? t("forbidden") : t("load_error")}
        </p>
        {!forbidden && (
          <Button
            isLoading={suggestions.isFetching}
            onClick={() => void suggestions.refetch()}
            onMouseDown={keepEditorFocus}
            size="sm"
            variant="outline"
          >
            <RotateCwIcon aria-hidden="true" />
            {t("retry")}
          </Button>
        )}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div
        className={cn(
          SUGGESTION_POPUP_CLASS,
          "text-muted-foreground p-3 text-sm",
        )}
        role="status"
      >
        {t("empty")}
      </div>
    );
  }

  return (
    <div
      aria-busy={suggestions.isFetching}
      aria-label={t("label")}
      className={cn(
        SUGGESTION_POPUP_CLASS,
        "flex max-h-64 flex-col gap-1 overflow-y-auto p-1 transition-opacity duration-150 motion-reduce:transition-none",
        suggestions.isPlaceholderData && "opacity-60",
      )}
      id={listId}
      ref={listRef}
      role="listbox"
    >
      {items.map((item, index) => (
        <button
          aria-selected={index === activeIndex}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm",
            index === activeIndex && "bg-accent text-accent-foreground",
          )}
          data-active={index === activeIndex}
          id={optionIdOf(index)}
          key={item.id}
          onClick={() => select(index)}
          onMouseDown={keepEditorFocus}
          onMouseEnter={() => setActiveIndex(index)}
          role="option"
          type="button"
        >
          <Avatar alt="" aria-hidden="true" size={24} user={item} />
          <span className="truncate font-medium">{item.name}</span>
          <span className="text-muted-foreground truncate">
            @{item.nameCode}
          </span>
        </button>
      ))}
    </div>
  );
};
