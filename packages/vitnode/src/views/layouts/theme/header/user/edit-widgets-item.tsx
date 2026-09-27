import { PencilRulerIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { useStartEditWidgets } from "@/blocks/edit-widgets-context";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export const EditWidgetsMenuItem = () => {
  const startEditWidgets = useStartEditWidgets();
  const t = useTranslations("core.global.user_bar");

  if (startEditWidgets === null) return null;

  return (
    <>
      <DropdownMenuGroup>
        <DropdownMenuItem onClick={startEditWidgets}>
          <PencilRulerIcon />
          <span>{t("edit_widgets")}</span>
        </DropdownMenuItem>
      </DropdownMenuGroup>

      <DropdownMenuSeparator />
    </>
  );
};
