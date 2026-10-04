import type { SuggestionProps } from "@tiptap/suggestion";

import React from "react";

export const SUGGESTION_POPUP_WRAPPER_CLASS = "group/suggestion z-50";

export const SUGGESTION_POPUP_CLASS =
  "bg-popover text-popover-foreground ring-foreground/10 animate-in fade-in-0 zoom-in-95 w-72 rounded-lg shadow-md ring-1 duration-100 motion-reduce:animate-none origin-top-left rtl:origin-top-right group-data-[side=top]/suggestion:origin-bottom-left rtl:group-data-[side=top]/suggestion:origin-bottom-right";

export const mountSuggestionPopup = (
  mount: SuggestionProps["mount"],
  element: HTMLElement,
) => {
  element.style.visibility = "hidden";
  element.style.width = "max-content";

  return mount(element, {
    onPosition: ({ placement, strategy, x, y }) => {
      element.dataset.side = placement.split("-")[0];
      Object.assign(element.style, {
        left: `${x}px`,
        position: strategy,
        top: `${y}px`,
        visibility: "",
      });
    },
  });
};

export const useActiveDescendant = ({
  activeId,
  listId,
  textbox,
}: {
  activeId: string | undefined;
  listId: string;
  textbox: HTMLElement | undefined;
}) => {
  React.useEffect(() => {
    if (!textbox) return;

    textbox.setAttribute("aria-controls", listId);
    if (activeId) {
      textbox.setAttribute("aria-activedescendant", activeId);
    } else {
      textbox.removeAttribute("aria-activedescendant");
    }

    return () => {
      textbox.removeAttribute("aria-activedescendant");
      textbox.removeAttribute("aria-controls");
    };
  }, [activeId, listId, textbox]);
};
