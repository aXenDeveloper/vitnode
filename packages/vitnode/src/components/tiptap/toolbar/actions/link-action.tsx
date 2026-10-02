import { useEditorState } from "@tiptap/react";
import { LinkIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Toggle } from "@/components/ui/toggle";

import { useToolbarEditor } from "../use-toolbar-editor";
import { ToolbarTooltip } from "./utils/toolbar-tooltip";

export const LinkAction = () => {
  const t = useTranslations("core.global.editor.link");
  const { editor } = useToolbarEditor();
  const inputId = React.useId();
  const [open, setOpen] = React.useState(false);
  const [href, setHref] = React.useState("");
  const isLink = useEditorState({
    editor,
    selector: ctx => ctx.editor.isActive("link"),
  });

  const onOpenChange = (next: boolean) => {
    if (next) {
      const current: unknown = editor.getAttributes("link").href;
      setHref(typeof current === "string" ? current : "");
    }
    setOpen(next);
  };

  const save = () => {
    const trimmed = href.trim();
    const chain = editor.chain().focus().extendMarkRange("link");
    if (trimmed) chain.setLink({ href: trimmed }).run();
    else chain.unsetLink().run();
    setOpen(false);
  };

  const remove = () => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setOpen(false);
  };

  return (
    <Popover onOpenChange={onOpenChange} open={open}>
      <ToolbarTooltip text={t("label")}>
        <PopoverTrigger
          render={
            <Toggle
              aria-label={t("label")}
              className="size-8"
              pressed={isLink}
              size="sm"
            />
          }
        >
          <LinkIcon />
        </PopoverTrigger>
      </ToolbarTooltip>

      <PopoverContent align="start" className="w-80">
        <form
          className="flex flex-col gap-3"
          onSubmit={event => {
            event.preventDefault();
            event.stopPropagation();
            save();
          }}
        >
          <label className="text-sm font-medium" htmlFor={inputId}>
            {t("address")}
          </label>
          <Input
            autoComplete="off"
            className="text-base md:text-sm"
            id={inputId}
            onChange={event => setHref(event.target.value)}
            placeholder="https://"
            spellCheck={false}
            type="url"
            value={href}
          />
          <div className="flex items-center justify-end gap-2">
            {isLink && (
              <Button onClick={remove} size="sm" type="button" variant="ghost">
                {t("remove")}
              </Button>
            )}
            <Button size="sm" type="submit">
              {t("save")}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
};
