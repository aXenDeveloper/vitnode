import { AudioLinesIcon, ChevronDownIcon, PlusIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { TooltipWithContent } from "@/components/ui/tooltip";

import { BLOCK_COMMANDS } from "../../block-commands";
import { useToolbarEditor } from "../use-toolbar-editor";
import { AudioDialog } from "./audio-action";

const INSERT_COMMANDS = BLOCK_COMMANDS.filter(
  command => command.group === "insert" || command.id === "quote",
);

export const InsertAction = () => {
  const t = useTranslations("core.global.editor");
  const { editor } = useToolbarEditor();
  const [isAudioOpen, setIsAudioOpen] = React.useState(false);

  return (
    <>
      <DropdownMenu>
        <TooltipWithContent text={t("insert.label")}>
          <DropdownMenuTrigger
            render={
              <Button
                aria-label={t("insert.label")}
                className="gap-0.5"
                size="sm"
                variant="ghost"
              />
            }
          >
            <PlusIcon />
            <ChevronDownIcon className="text-muted-foreground" />
          </DropdownMenuTrigger>
        </TooltipWithContent>

        <DropdownMenuContent align="end" className="min-w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{t("insert.label")}</DropdownMenuLabel>
            {INSERT_COMMANDS.map(command => (
              <DropdownMenuItem
                key={command.id}
                onClick={() => command.run(editor)}
              >
                {command.icon}
                <span className="flex min-w-0 flex-col">
                  <span>{t(`blocks.${command.id}.title`)}</span>
                  <span className="text-muted-foreground text-xs">
                    {t(`blocks.${command.id}.hint`)}
                  </span>
                </span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onClick={() => setIsAudioOpen(true)}>
              <AudioLinesIcon />
              <span className="flex min-w-0 flex-col">
                <span>{t("audio.label")}</span>
                <span className="text-muted-foreground text-xs">
                  {t("audio.hint")}
                </span>
              </span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <p className="text-muted-foreground px-2 py-1.5 text-xs leading-relaxed">
            {t.rich("insert.tip", {
              key: chunks => <Kbd>{chunks}</Kbd>,
            })}
          </p>
        </DropdownMenuContent>
      </DropdownMenu>

      <AudioDialog onOpenChange={setIsAudioOpen} open={isAudioOpen} />
    </>
  );
};
