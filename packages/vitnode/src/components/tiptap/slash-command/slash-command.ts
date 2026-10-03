import { PluginKey } from "@tiptap/pm/state";
import { Extension, ReactRenderer } from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";

import { BLOCK_COMMANDS, type BlockCommand } from "../block-commands";
import {
  mountSuggestionPopup,
  SUGGESTION_POPUP_WRAPPER_CLASS,
} from "../suggestion-popup";
import {
  SlashCommandList,
  type SlashCommandListRef,
} from "./slash-command-list";

export const slashCommandPluginKey = new PluginKey("slashCommand");

export const SlashCommand = Extension.create<{ commands: BlockCommand[] }>({
  name: "slashCommand",
  addOptions() {
    return { commands: BLOCK_COMMANDS };
  },
  addProseMirrorPlugins() {
    const { commands } = this.options;

    return [
      Suggestion<BlockCommand, BlockCommand>({
        editor: this.editor,
        char: "/",
        pluginKey: slashCommandPluginKey,
        items: () => commands,
        command: ({ editor, range, props }) => {
          editor.chain().focus().deleteRange(range).run();
          props.run(editor);
        },
        render: () => {
          let component: null | ReactRenderer<
            SlashCommandListRef,
            React.ComponentProps<typeof SlashCommandList>
          > = null;
          let unmount: (() => void) | null = null;

          return {
            onStart: props => {
              component = new ReactRenderer(SlashCommandList, {
                className: SUGGESTION_POPUP_WRAPPER_CLASS,
                editor: props.editor,
                props: {
                  command: props.command,
                  commands: props.items,
                  query: props.query,
                  textbox: props.editor.view.dom,
                },
              });
              unmount = mountSuggestionPopup(props.mount, component.element);
            },
            onUpdate: props => {
              component?.updateProps({
                command: props.command,
                commands: props.items,
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
      }),
    ];
  },
});
