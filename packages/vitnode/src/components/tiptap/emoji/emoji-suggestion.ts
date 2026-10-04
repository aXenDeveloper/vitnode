import type { EmojiItem } from "@tiptap/extension-emoji";
import type { SuggestionOptions } from "@tiptap/suggestion";

import { ReactRenderer } from "@tiptap/react";

import type { EmojiSuggestionListRef } from "./emoji-suggestion-list";

import {
  mountSuggestionPopup,
  SUGGESTION_POPUP_WRAPPER_CLASS,
} from "../suggestion-popup";
import { EmojiSuggestionList } from "./emoji-suggestion-list";
import { matchEmojis } from "./match-emojis";

interface EmojiSuggestionProps {
  command: (props: { name: string }) => void;
  items: EmojiItem[];
  textbox?: HTMLElement;
}

export const emojiSuggestion: Omit<
  SuggestionOptions<EmojiItem, { name: string }>,
  "editor"
> = {
  items: ({ editor, query }) => matchEmojis(editor.storage.emoji.emojis, query),
  render: () => {
    let component: null | ReactRenderer<
      EmojiSuggestionListRef,
      EmojiSuggestionProps
    > = null;
    let unmount: (() => void) | null = null;

    return {
      onStart: props => {
        component = new ReactRenderer(EmojiSuggestionList, {
          className: SUGGESTION_POPUP_WRAPPER_CLASS,
          editor: props.editor,
          props: {
            command: props.command,
            items: props.items,
            textbox: props.editor.view.dom,
          },
        });
        unmount = mountSuggestionPopup(props.mount, component.element);
      },
      onUpdate: props => {
        component?.updateProps({
          command: props.command,
          items: props.items,
          textbox: props.editor.view.dom,
        });
      },
      onKeyDown: props => component?.ref?.onKeyDown(props) ?? false,
      onExit: () => {
        unmount?.();
        unmount = null;
        component?.destroy();
        component = null;
      },
    };
  },
};
