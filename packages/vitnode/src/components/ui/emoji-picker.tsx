import { EmojiPicker as Picker } from "@ferrucc-io/emoji-picker";
import React from "react";
import { useTranslations } from "use-intl";

export const EMOJI_PICKER_EMOJIS_PER_ROW = 9;
export const EMOJI_PICKER_EMOJI_SIZE = 30;
export const EMOJI_PICKER_LIST_HEIGHT = 288;
export const EMOJI_PICKER_INPUT_CLASS =
  "bg-muted text-foreground focus:ring-ring h-8 text-base focus:ring-2 md:text-sm";

export const EmojiPicker = ({
  autoFocus,
  height = EMOJI_PICKER_LIST_HEIGHT,
  onSelect,
}: {
  autoFocus?: boolean;
  height?: number;
  onSelect: (emoji: string) => void;
}) => {
  const t = useTranslations("core.global.emoji_icon_picker");

  return (
    <Picker
      className="h-auto w-full rounded-none border-0 bg-transparent shadow-none focus:ring-0"
      emojiSize={EMOJI_PICKER_EMOJI_SIZE}
      emojisPerRow={EMOJI_PICKER_EMOJIS_PER_ROW}
      onEmojiSelect={onSelect}
    >
      <Picker.Header className="px-2 pt-2 pb-1">
        <Picker.Input
          autoFocus={autoFocus}
          className={EMOJI_PICKER_INPUT_CLASS}
          placeholder={t("search_emoji")}
        />
      </Picker.Header>

      <Picker.Group>
        <Picker.List containerHeight={height} />
      </Picker.Group>

      <div className="flex min-h-11 items-center gap-1 border-t px-2 py-1">
        <Picker.Preview className="min-w-0 flex-1 border-0 bg-transparent p-0">
          {({ previewedEmoji }) => (
            <span className="flex min-w-0 items-center gap-2">
              {previewedEmoji ? (
                <>
                  <span aria-hidden className="text-lg leading-none">
                    {previewedEmoji.emoji}
                  </span>
                  <span className="text-muted-foreground truncate text-xs">
                    {previewedEmoji.name}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground truncate text-xs">
                  {t("hint_emoji")}
                </span>
              )}
            </span>
          )}
        </Picker.Preview>

        <div aria-label={t("skin_tone")} className="shrink-0" role="group">
          <Picker.SkinTone />
        </div>
      </div>
    </Picker>
  );
};
