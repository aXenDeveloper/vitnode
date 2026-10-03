import { EmojiPicker as Picker } from "@ferrucc-io/emoji-picker";
import { emojiToShortcode } from "@tiptap/extension-emoji";
import React from "react";
import { useTranslations } from "use-intl";

import { useEditorConfig } from "@/components/editor-provider";
import {
  EMOJI_PICKER_EMOJI_SIZE,
  EMOJI_PICKER_EMOJIS_PER_ROW,
  EMOJI_PICKER_INPUT_CLASS,
  EMOJI_PICKER_LIST_HEIGHT,
} from "@/components/ui/emoji-picker";

import {
  customEmojiToPickerSections,
  shortcodeOf,
} from "../../../emoji/custom-emoji";
import { useToolbarEditor } from "../../use-toolbar-editor";

export const EmojiPicker = ({ onSelect }: { onSelect: () => void }) => {
  const t = useTranslations("core.global.editor.emoji");
  const tPicker = useTranslations("core.global.emoji_icon_picker");
  const { editor } = useToolbarEditor();
  const { emojis } = useEditorConfig();
  const customSections = React.useMemo(
    () => customEmojiToPickerSections(emojis),
    [emojis],
  );
  const customSources = React.useMemo(
    () =>
      new Map(
        emojis?.flatMap(section =>
          section.emojis.map(emoji => [emoji.name, emoji.src] as const),
        ),
      ),
    [emojis],
  );

  return (
    <Picker
      className="h-auto w-full rounded-none border-0 bg-transparent shadow-none focus:ring-0"
      customSections={customSections}
      emojiSize={EMOJI_PICKER_EMOJI_SIZE}
      emojisPerRow={EMOJI_PICKER_EMOJIS_PER_ROW}
      onEmojiSelect={selected => {
        const shortcode =
          shortcodeOf(selected) ??
          emojiToShortcode(selected, editor.storage.emoji.emojis);
        const chain = editor.chain().focus();

        if (shortcode) {
          chain.setEmoji(shortcode).run();
        } else {
          chain.insertContent(selected).run();
        }

        onSelect();
      }}
    >
      <Picker.Header className="px-2 pt-2 pb-1">
        <Picker.Input
          autoFocus
          className={EMOJI_PICKER_INPUT_CLASS}
          placeholder={t("search")}
        />
      </Picker.Header>

      <Picker.Group>
        <Picker.List containerHeight={EMOJI_PICKER_LIST_HEIGHT} />
      </Picker.Group>

      <div className="flex min-h-11 items-center gap-1 border-t px-2 py-1">
        <Picker.Preview className="min-w-0 flex-1 border-0 bg-transparent p-0">
          {({ previewedEmoji }) => {
            if (!previewedEmoji) {
              return (
                <span className="text-muted-foreground text-xs">
                  {t("hint")}
                </span>
              );
            }

            const customName = shortcodeOf(previewedEmoji.emoji);
            const customSrc = customName
              ? customSources.get(customName)
              : undefined;
            const shortcode =
              customName ??
              emojiToShortcode(
                previewedEmoji.emoji,
                editor.storage.emoji.emojis,
              );

            return (
              <span className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden
                  className="flex size-7 shrink-0 items-center justify-center text-2xl leading-none"
                >
                  {customSrc ? (
                    <img alt="" className="h-6 w-auto" src={customSrc} />
                  ) : (
                    previewedEmoji.emoji
                  )}
                </span>

                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="truncate text-xs font-medium">
                    {previewedEmoji.name}
                  </span>

                  {!!shortcode && (
                    <span className="text-muted-foreground truncate text-xs">
                      :{shortcode}:
                    </span>
                  )}
                </span>
              </span>
            );
          }}
        </Picker.Preview>

        <div
          aria-label={tPicker("skin_tone")}
          className="shrink-0"
          role="group"
        >
          <Picker.SkinTone />
        </div>
      </div>
    </Picker>
  );
};
