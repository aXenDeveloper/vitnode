import { SmilePlusIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { TooltipWithContent } from "@/components/ui/tooltip";

const EmojiPicker = React.lazy(async () =>
  import("./emoji/emoji-picker").then(module => ({
    default: module.EmojiPicker,
  })),
);

export const EmojiAction = () => {
  const t = useTranslations("core.global.editor.emoji");
  const [open, setOpen] = React.useState(false);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <TooltipWithContent text={t("label")}>
        <PopoverTrigger
          render={
            <Button aria-label={t("label")} size="icon-sm" variant="ghost" />
          }
        >
          <SmilePlusIcon />
        </PopoverTrigger>
      </TooltipWithContent>

      <PopoverContent className="w-76 gap-0 p-0">
        <React.Suspense
          fallback={
            <div className="flex h-94 items-center justify-center">
              <div className="flex items-center justify-center">
                <Spinner size="xl" />
              </div>
            </div>
          }
        >
          <EmojiPicker onSelect={() => setOpen(false)} />
        </React.Suspense>
      </PopoverContent>
    </Popover>
  );
};
