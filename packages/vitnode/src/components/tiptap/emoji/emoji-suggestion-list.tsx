import type { EmojiItem } from "@tiptap/extension-emoji";
import type {
  SuggestionKeyDownProps,
  SuggestionProps,
} from "@tiptap/suggestion";

import { cn } from "cn";
import React from "react";
import { useTranslations } from "use-intl";

import {
  SUGGESTION_POPUP_CLASS,
  useActiveDescendant,
} from "../suggestion-popup";

export interface EmojiSuggestionListRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

export const EmojiSuggestionList = ({
  command,
  items,
  ref,
  textbox,
}: Pick<SuggestionProps<EmojiItem>, "command" | "items"> & {
  ref?: React.Ref<EmojiSuggestionListRef>;
  textbox?: HTMLElement;
}) => {
  const t = useTranslations("core.global.editor.emoji");
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

    command({ name: item.name });
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
      aria-label={t("label")}
      className={cn(
        SUGGESTION_POPUP_CLASS,
        "flex max-h-64 flex-col gap-1 overflow-y-auto p-1",
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
          key={item.name}
          onClick={() => select(index)}
          onMouseEnter={() => setActiveIndex(index)}
          role="option"
          type="button"
        >
          <span aria-hidden className="text-lg leading-none">
            {item.fallbackImage && !item.emoji ? (
              <img alt="" className="size-5" src={item.fallbackImage} />
            ) : (
              item.emoji
            )}
          </span>
          <span className="truncate">:{item.shortcodes[0]}:</span>
        </button>
      ))}
    </div>
  );
};
