import CodeBlockExt, { CodeBlockOptions } from '@tiptap/extension-code-block';
import { cn } from 'vitnode-frontend/helpers/classnames';

import { renderReactNode } from './client';
import { ShikiPlugin } from './shiki-plugin';

export const CodeBlock = CodeBlockExt.extend<CodeBlockOptions>({
  addNodeView() {
    return renderReactNode();
  },
  addProseMirrorPlugins() {
    return [...(this.parent?.() ?? []), ShikiPlugin(this.name)];
  },
}).configure({
  defaultLanguage: 'plaintext',
  languageClassPrefix: 'language-',
});

export const classNameCodeBlock = cn(
  'block overflow-auto whitespace-pre-wrap p-5 text-sm',
);
