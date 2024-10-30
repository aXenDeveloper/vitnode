/* eslint-disable @typescript-eslint/ban-ts-comment */
import { Mention } from '@tiptap/extension-mention';

import { onExit, onKeyDown, onStart, onUpdate } from './client';

export const MentionExtensionEditor = Mention.configure({
  suggestion: {
    items: ({ query }) => {
      return [
        'Lea Thompson',
        'Cyndi Lauper',
        'Tom Cruise',
        'Madonna',
        'Jerry Hall',
        'Joan Collins',
        'Winona Ryder',
        'Christina Applegate',
        'Alyssa Milano',
        'Molly Ringwald',
        'Ally Sheedy',
        'Debbie Harry',
        'Olivia Newton-John',
        'Elton John',
        'Michael J. Fox',
        'Axl Rose',
        'Emilio Estevez',
        'Ralph Macchio',
        'Rob Lowe',
        'Jennifer Grey',
        'Mickey Rourke',
        'John Cusack',
        'Matthew Broderick',
        'Justine Bateman',
        'Lisa Bonet',
      ]
        .filter(item => item.toLowerCase().startsWith(query.toLowerCase()))
        .slice(0, 5);
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
