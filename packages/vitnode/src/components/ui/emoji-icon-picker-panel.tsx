import { ShapesIcon, SmileIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import type { EmojiIconValue } from "@/lib/emoji-icon";

import type { EmojiIconPickerKind } from "./emoji-icon-picker";

import { EMOJI_ICON_PICKER_KINDS } from "./emoji-icon-picker";
import { EmojiPicker } from "./emoji-picker";
import { IconPicker } from "./icon-picker";
import { Tabs, TabsContent, TabsList, TabsPanels, TabsTrigger } from "./tabs";

const PANEL_HEIGHT = 288;

const EmojiPanel = ({
  onChange,
}: {
  onChange: (value: EmojiIconValue) => void;
}) => (
  <EmojiPicker
    autoFocus
    height={PANEL_HEIGHT}
    onSelect={emoji => onChange({ type: "emoji", value: emoji })}
  />
);

const IconPanel = ({
  onChange,
  value,
}: {
  onChange: (value: EmojiIconValue) => void;
  value?: EmojiIconValue;
}) => (
  <IconPicker
    autoFocus
    height={PANEL_HEIGHT}
    onSelect={name => onChange({ type: "icon", value: name })}
    value={value?.type === "icon" ? value.value : undefined}
  />
);

export const EmojiIconPickerPanel = ({
  allow = EMOJI_ICON_PICKER_KINDS,
  onChange,
  value,
}: {
  allow?: readonly EmojiIconPickerKind[];
  onChange: (value: EmojiIconValue | undefined) => void;
  value?: EmojiIconValue;
}) => {
  const t = useTranslations("core.global.emoji_icon_picker");
  const [mode, setMode] = React.useState<string>(
    allow.includes(value?.type ?? "emoji")
      ? (value?.type ?? "emoji")
      : allow[0],
  );

  // One kind on its own needs no tab strip to switch between.
  if (allow.length === 1) {
    return allow[0] === "emoji" ? (
      <EmojiPanel onChange={onChange} />
    ) : (
      <IconPanel onChange={onChange} value={value} />
    );
  }

  return (
    <Tabs
      className="gap-0"
      onValueChange={next => setMode(String(next))}
      value={mode}
    >
      <div className="flex items-center gap-2 border-b p-2">
        <TabsList className="flex-1">
          <TabsTrigger value="emoji">
            <SmileIcon />
            {t("emoji")}
          </TabsTrigger>
          <TabsTrigger value="icon">
            <ShapesIcon />
            {t("icon")}
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsPanels>
        <TabsContent value="emoji">
          <EmojiPanel onChange={onChange} />
        </TabsContent>

        <TabsContent value="icon">
          <IconPanel onChange={onChange} value={value} />
        </TabsContent>
      </TabsPanels>
    </Tabs>
  );
};
