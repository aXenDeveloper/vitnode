import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { all, createLowlight } from 'lowlight';
import { cn } from 'vitnode-frontend/helpers/classnames';

import { renderReactNode } from './client';

export const lowlight = createLowlight(all);

export const classNameCodeBlock = cn(
  'block overflow-auto whitespace-pre-wrap p-5 text-sm',
  '[&_.hljs-string]:text-green-700 dark:[&_.hljs-string]:text-green-400',
  String.raw`[&_.hljs-built\_in]:text-emerald-600 dark:[&_.hljs-built\_in]:text-emerald-500`,
  '[&_.hljs-attr]:text-purple-600 dark:[&_.hljs-attr]:text-purple-400 [&_.hljs-keyword]:text-purple-600 dark:[&_.hljs-keyword]:text-purple-400 [&_.hljs-strong]:text-purple-600 dark:[&_.hljs-strong]:text-purple-400',
  '[&_.hljs-title]:text-red-500',
  '[&_.hljs-meta]:text-cyan-600 dark:[&_.hljs-meta]:text-cyan-500 [&_.hljs-section]:text-cyan-600 dark:[&_.hljs-section]:text-cyan-500',
  '[&_.hljs-variable]:text-blue-700 dark:[&_.hljs-variable]:text-blue-400',
  '[&_.hljs-number]:text-sky-600 dark:[&_.hljs-number]:text-sky-500',
  '[&_.hljs-bullet]:text-yellow-700 dark:[&_.hljs-bullet]:text-yellow-500 [&_.hljs-name]:text-yellow-700 dark:[&_.hljs-name]:text-yellow-500 [&_.hljs-operator]:text-yellow-700 dark:[&_.hljs-operator]:text-yellow-500 [&_.hljs-punctuation]:text-yellow-700 dark:[&_.hljs-punctuation]:text-yellow-500 [&_.hljs-type]:text-yellow-700 dark:[&_.hljs-type]:text-yellow-500',
  '[&_.hljs-attribute]:text-orange-700 dark:[&_.hljs-attribute]:text-orange-500 [&_.hljs-selector-class]:text-orange-700 dark:[&_.hljs-selector-class]:text-orange-500 [&_.hljs-selector-tag]:text-orange-700 dark:[&_.hljs-selector-tag]:text-orange-500',
  '[&_.hljs-comment]:text-muted-foreground',
  '[&_.hljs-regexp]:text-rose-600',
);

export const CodeBlockLowlightExtensionEditor = CodeBlockLowlight.extend({
  addNodeView() {
    return renderReactNode();
  },
}).configure({
  lowlight: lowlight,
  languageClassPrefix: 'language-',
});

// import { NodeViewWrapper } from "@tiptap/react";
// import Image from "next/image";

// export const ImageFromNextWithNode = ({
//   node
// }: {
//   node: { attrs: { src: string } };
// }) => {
//   return (
//     <NodeViewWrapper>
//       <Image src={node.attrs.src} alt="" width={500} height={500} />
//     </NodeViewWrapper>
//   );
// };
