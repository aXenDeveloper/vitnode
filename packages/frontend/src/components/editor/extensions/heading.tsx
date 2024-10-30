import { Heading, Level } from '@tiptap/extension-heading';
import { mergeAttributes } from '@tiptap/react';

export const HeadingExtensionEditor = () => {
  return Heading.extend({
    levels: [1, 2],
    renderHTML({ HTMLAttributes, node }) {
      const level = this.options.levels.includes(node.attrs.level as Level)
        ? node.attrs.level
        : this.options.levels[0];
      const classes: Record<number, string> = {
        1: 'text-4xl font-extrabold',
        2: 'text-3xl font-bold',
        3: 'text-2xl font-bold',
        4: 'text-xl font-bold',
        5: 'text-lg font-bold',
        6: 'text-base font-bold',
      };

      return [
        `h${level}`,
        mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
          class: classes[level],
        }),
        0,
      ];
    },
  }).configure({
    levels: [1, 2, 3, 4, 5, 6],
  });
};
