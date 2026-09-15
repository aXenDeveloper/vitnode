import { ShapesIcon, SmileIcon, XIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import type { EmojiIconValue } from "@/lib/emoji-icon";

import { Button } from "./button";
import { EmojiPicker } from "./emoji-picker";
import { IconPicker } from "./icon-picker";
import { Tabs, TabsContent, TabsList, TabsPanels, TabsTrigger } from "./tabs";

const PANEL_HEIGHT = 288;

export const EmojiIconPickerPanel = ({
  allowRemove,
  onChange,
  value,
}: {
  allowRemove?: boolean;
  onChange: (value: EmojiIconValue | undefined) => void;
  value?: EmojiIconValue;
}) => {
  const t = useTranslations("core.global.emoji_icon_picker");
  const [mode, setMode] = React.useState<string>(value?.type ?? "emoji");

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

        {allowRemove && !!value && (
          <Button
            aria-label={t("remove")}
            onClick={() => onChange(undefined)}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <XIcon />
          </Button>
        )}
      </div>

      <TabsPanels>
        <TabsContent value="emoji">
          <EmojiPicker
            autoFocus
            height={PANEL_HEIGHT}
            onSelect={emoji => onChange({ type: "emoji", value: emoji })}
          />
        </TabsContent>

        <TabsContent value="icon">
          <IconPicker
            autoFocus
            height={PANEL_HEIGHT}
            onSelect={name => onChange({ type: "icon", value: name })}
            value={value?.type === "icon" ? value.value : undefined}
          />
        </TabsContent>
      </TabsPanels>
    </Tabs>
  );
};
