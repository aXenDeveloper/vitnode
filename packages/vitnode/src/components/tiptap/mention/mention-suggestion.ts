import type { SuggestionOptions } from "@tiptap/suggestion";

import { ReactRenderer } from "@tiptap/react";

import type {
  MentionSuggestionListProps,
  MentionSuggestionListRef,
} from "./mention-suggestion-list";

import {
  mountSuggestionPopup,
  SUGGESTION_POPUP_WRAPPER_CLASS,
} from "../suggestion-popup";
import { MentionSuggestionList } from "./mention-suggestion-list";

/** What a picked member inserts. */
export interface MentionCommandProps {
  id: number;
  label: string;
  nameCode: string;
}

/**
 * The `@` popup. The list fetches its own members, so `items` stays empty
 * and the popup can show loading, empty and error states while it waits.
 */
export const mentionSuggestion = ({
  isEnabled,
}: {
  isEnabled: () => boolean;
}): Omit<SuggestionOptions<never, MentionCommandProps>, "editor"> => ({
  allow: () => isEnabled(),
  allowSpaces: false,
  char: "@",
  items: () => [],
  render: () => {
    let component: null | ReactRenderer<
      MentionSuggestionListRef,
      MentionSuggestionListProps
    > = null;
    let unmount: (() => void) | null = null;

    return {
      onStart: props => {
        component = new ReactRenderer(MentionSuggestionList, {
          className: SUGGESTION_POPUP_WRAPPER_CLASS,
          editor: props.editor,
          props: {
            command: props.command,
            query: props.query,
            textbox: props.editor.view.dom,
          },
        });
        unmount = mountSuggestionPopup(props.mount, component.element);
      },
      onUpdate: props => {
        component?.updateProps({
          command: props.command,
          query: props.query,
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
});
