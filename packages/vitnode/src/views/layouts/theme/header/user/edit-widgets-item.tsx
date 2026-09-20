import { PencilRulerIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { useEditWidgets } from "@/blocks/edit-widgets-context";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export const EditWidgetsMenuItem = () => {
  const control = useEditWidgets();
  const t = useTranslations("core.global.user_bar");

  if (control === null || control.offer?.canEdit !== true || control.editing) {
    return null;
  }

  return (
    <>
      <DropdownMenuGroup>
        <DropdownMenuItem
          onClick={() => {
            control.start();
          }}
        >
          <PencilRulerIcon />
          <span>{t("edit_widgets")}</span>
        </DropdownMenuItem>
      </DropdownMenuGroup>

      <DropdownMenuSeparator />
    </>
  );
};
