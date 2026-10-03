import type { SuggestionKeyDownProps } from "@tiptap/suggestion";

import { cn } from "cn";
import React from "react";
import { useTranslations } from "use-intl";

import {
  BLOCK_COMMAND_GROUPS,
  type BlockCommand,
  matchBlockCommands,
} from "../block-commands";
import {
  SUGGESTION_POPUP_CLASS,
  useActiveDescendant,
} from "../suggestion-popup";

export interface SlashCommandListRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

export const SlashCommandList = ({
  commands,
  query,
  command,
  ref,
  textbox,
}: {
  command: (item: BlockCommand) => void;
  commands: BlockCommand[];
  query: string;
  ref?: React.Ref<SlashCommandListRef>;
  textbox?: HTMLElement;
}) => {
  const t = useTranslations("core.global.editor.blocks");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [renderedQuery, setRenderedQuery] = React.useState(query);
  const listRef = React.useRef<HTMLDivElement>(null);
  const groupId = React.useId();
  const listId = `${groupId}-list`;
  const optionIdOf = (item: BlockCommand) => `${groupId}-option-${item.id}`;
  const items = matchBlockCommands({
    commands,
    query,
    getTitle: item => t(`${item.id}.title`),
  });

  if (renderedQuery !== query) {
    setRenderedQuery(query);
    setActiveIndex(0);
  }

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
        const item = items.at(activeIndex);
        if (item) command(item);

        return true;
      }

      return false;
    },
  }));

  const activeItem = items.at(activeIndex);
  useActiveDescendant({
    activeId: activeItem ? optionIdOf(activeItem) : undefined,
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
        "flex max-h-80 flex-col gap-1 overflow-y-auto p-1",
      )}
      id={listId}
      ref={listRef}
      role="listbox"
    >
      {BLOCK_COMMAND_GROUPS.map(group => {
        const groupItems = items.filter(item => item.group === group);
        if (groupItems.length === 0) return null;

        return (
          <div
            aria-labelledby={`${groupId}-${group}`}
            className="flex flex-col"
            key={group}
            role="group"
          >
            <div
              className="text-muted-foreground px-2 pt-2 pb-1 text-xs font-medium"
              id={`${groupId}-${group}`}
            >
              {t(`groups.${group}`)}
            </div>
            {groupItems.map(item => {
              const index = items.indexOf(item);
              const isActive = index === activeIndex;

              return (
                <button
                  aria-selected={isActive}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-start",
                    isActive && "bg-accent text-accent-foreground",
                  )}
                  data-active={isActive}
                  id={optionIdOf(item)}
                  key={item.id}
                  onClick={() => command(item)}
                  onMouseEnter={() => setActiveIndex(index)}
                  role="option"
                  type="button"
                >
                  <span className="bg-background ring-foreground/10 text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-md ring-1 [&_svg]:size-4">
                    {item.icon}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">
                      {t(`${item.id}.title`)}
                    </span>
                    <span className="text-muted-foreground truncate text-xs">
                      {t(`${item.id}.hint`)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};
