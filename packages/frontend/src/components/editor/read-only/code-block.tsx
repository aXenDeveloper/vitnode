import { cn } from '@/helpers/classnames';
import { Element } from 'html-react-parser';
import React from 'react';

import { classNameCodeBlock } from '../extensions/code/code';
import { shikiParser } from '../extensions/code/shiki-parser';

export const CodeBlockReadOnly = async ({ element }: { element: Element }) => {
  const node = element.children[0] as Element;
  const lang = node.attribs.class?.replace('language-', '');
  const text = (node.children[0] as { data?: string }).data ?? '';
  const out = await shikiParser(text, lang);

  return (
    <div
      className={cn(classNameCodeBlock, 'bg-border/20 rounded-md border')}
      dangerouslySetInnerHTML={{ __html: out }}
    />
  );
};
