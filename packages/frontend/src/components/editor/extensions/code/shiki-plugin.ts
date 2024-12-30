// Source: https://github.com/hunghg255/reactjs-tiptap-editor/tree/main/src/extensions/CodeBlock

import type { Node as ProsemirrorNode } from '@tiptap/pm/model';
import type { PluginView } from '@tiptap/pm/state';
import type { BundledLanguage, BundledTheme } from 'shiki';

import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { findChildren } from '@tiptap/react';

import {
  getShiki,
  initHighlighter,
  loadLanguage,
  loadTheme,
} from './highlighter';

/** Create code decorations for the current document */
function getDecorations({ doc, name }: { doc: ProsemirrorNode; name: string }) {
  const decorations: Decoration[] = [];
  const codeBlocks = findChildren(doc, node => node.type.name === name);
  codeBlocks.forEach(block => {
    let from = block.pos + 1;
    let language: 'plaintext' | BundledLanguage =
      block.node.attrs.language || 'plaintext';

    const highlighter = getShiki();
    if (!highlighter) return;
    if (!highlighter.getLoadedLanguages().includes(language)) {
      language = 'plaintext';
    }

    const tokens = highlighter.codeToTokensBase(block.node.textContent, {
      lang: language,
    });

    for (const line of tokens) {
      for (const token of line) {
        const to = from + token.content.length;

        const decoration = Decoration.inline(from, to, {
          style: `color: ${token.color}`,
        });

        decorations.push(decoration);

        from = to;
      }

      from += 1;
    }
  });

  return DecorationSet.create(doc, decorations);
}

export function ShikiPlugin(name: string) {
  const shikiPlugin = new Plugin({
    key: new PluginKey('shiki'),

    view(view) {
      // This small view is just for initial async handling
      class ShikiPluginView implements PluginView {
        constructor() {
          void this.initDecorations();
        }

        // When new codeblocks were added and they have missing themes or
        // languages, load those and then add code decorations once again.
        async checkUndecoratedBlocks() {
          const codeBlocks = findChildren(
            view.state.doc,
            node => node.type.name === name,
          );

          // Load missing themes or languages when necessary.
          // loadStates is an array with booleans depending on if a theme/lang
          // got loaded.
          const loadStates = await Promise.all(
            codeBlocks.flatMap(block => [
              loadTheme(block.node.attrs.theme as BundledTheme),
              loadLanguage(block.node.attrs.language as BundledLanguage),
            ]),
          );
          const didLoadSomething = loadStates.includes(true);

          // The asynchronous nature of this is potentially prone to
          // race conditions. Imma just hope it's fine lol

          if (didLoadSomething) {
            const tr = view.state.tr.setMeta(
              'shikiPluginForceDecoration',
              true,
            );
            view.dispatch(tr);
          }
        }

        destroy() {}

        // Initialize shiki async, and then highlight initial document
        async initDecorations() {
          await initHighlighter();
          const tr = view.state.tr.setMeta('shikiPluginForceDecoration', true);
          view.dispatch(tr);
        }

        async update() {
          await this.checkUndecoratedBlocks();
        }
      }

      return new ShikiPluginView();
    },

    state: {
      init: (_, { doc }) => {
        return getDecorations({
          doc,
          name,
        });
      },
      apply: (transaction, decorationSet, oldState, newState) => {
        const oldNodeName = oldState.selection.$head.parent.type.name;
        const newNodeName = newState.selection.$head.parent.type.name;
        const oldNodes = findChildren(
          oldState.doc,
          node => node.type.name === name,
        );
        const newNodes = findChildren(
          newState.doc,
          node => node.type.name === name,
        );

        const didChangeSomeCodeBlock =
          transaction.docChanged &&
          // Apply decorations if:
          // selection includes named node,
          ([newNodeName, oldNodeName].includes(name) ||
            // OR transaction adds/removes named node,
            newNodes.length !== oldNodes.length ||
            // OR transaction has changes that completely encapsulte a node
            // (for example, a transaction that affects the entire document).
            // Such transactions can happen during collab syncing via y-prosemirror, for example.
            transaction.steps.some(stepProp => {
              const step = stepProp as unknown as { from: number; to: number };

              return (
                step.from !== undefined &&
                step.to !== undefined &&
                oldNodes.some(node => {
                  return (
                    node.pos >= step.from &&
                    node.pos + node.node.nodeSize <= step.to
                  );
                })
              );
            }));

        // only create code decoration when it's necessary to do so
        if (
          transaction.getMeta('shikiPluginForceDecoration') ||
          didChangeSomeCodeBlock
        ) {
          return getDecorations({
            doc: transaction.doc,
            name,
          });
        }

        return decorationSet.map(transaction.mapping, transaction.doc);
      },
    },

    props: {
      decorations(state) {
        return shikiPlugin.getState(state);
      },
    },
  });

  return shikiPlugin;
}
