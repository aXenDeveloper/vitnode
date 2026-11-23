import { Mention, type MentionOptions } from "@tiptap/extension-mention";

import {
  type MentionCommandProps,
  mentionSuggestion,
} from "./mention-suggestion";

const mentionIdFrom = (element: HTMLElement): null | number => {
  const id = Number(element.getAttribute("data-id"));

  return Number.isInteger(id) && id > 0 ? id : null;
};

const labelOf = (attrs: Record<string, unknown>): string => {
  const { id, label } = attrs;

  return typeof label === "string" && label !== "" ? label : String(id);
};

/**
 * The `@mention` node. Its attrs are `id` (the member), `label` and
 * `nameCode` (a snapshot of their name and URL name). It is always part of
 * the schema, so documents keep their mentions in any editor; the `@` popup
 * only opens while `isEnabled()` is true.
 */
export const createEditorMention = ({
  isEnabled,
}: {
  isEnabled: () => boolean;
}) =>
  Mention.extend<MentionOptions<never, MentionCommandProps>>({
    addAttributes() {
      return {
        id: {
          default: null,
          parseHTML: mentionIdFrom,
          renderHTML: attributes =>
            attributes.id ? { "data-id": attributes.id } : {},
        },
        label: {
          default: null,
          parseHTML: element => element.getAttribute("data-label"),
          renderHTML: attributes =>
            attributes.label ? { "data-label": attributes.label } : {},
        },
        nameCode: {
          default: null,
          parseHTML: element => element.getAttribute("data-name-code"),
          renderHTML: attributes =>
            attributes.nameCode
              ? { "data-name-code": attributes.nameCode }
              : {},
        },
      };
    },

    parseHTML() {
      return [
        { tag: 'span[data-type="mention"]' },
        // Copied from a rendered post, where a mention is a profile link.
        { priority: 60, tag: 'a[data-type="mention"]' },
      ];
    },
  }).configure({
    deleteTriggerWithBackspace: true,
    HTMLAttributes: { class: "mention" },
    renderHTML: ({ node, options }) => [
      "span",
      options.HTMLAttributes,
      `@${labelOf(node.attrs)}`,
    ],
    renderText: ({ node }) => `@${labelOf(node.attrs)}`,
    suggestion: mentionSuggestion({ isEnabled }),
  });
