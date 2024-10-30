/* eslint-disable @typescript-eslint/ban-ts-comment */
import emojiMartData, { Emoji } from '@emoji-mart/data';
import { Mention } from '@tiptap/extension-mention';
import { PluginKey } from '@tiptap/pm/state';
import { init, SearchIndex } from 'emoji-mart';

import { onExit, onKeyDown, onStart, onUpdate } from './client';

void init({ data: emojiMartData });

const EmojiPluginKey = new PluginKey('emoji-search');

export const EmojiExtensionEditor = Mention.extend({
  name: 'emoji-search',
}).configure({
  HTMLAttributes: {},
  suggestion: {
    char: ':',
    pluginKey: EmojiPluginKey,
    command: ({ editor, props, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({
          type: 'text',
          text: `${props.id}`,
        })
        .run();
    },
    items: async ({ query }) => {
      const emojis: Emoji[] =
        (await SearchIndex.search(query.toLowerCase())) ?? [];

      return emojis.slice(0, 5);
    },
    // @ts-expect-error
    render: () => {
      return {
        onStart,
        onUpdate,
        onKeyDown,
        onExit,
      };
    },
  },
});
