import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { useTheme } from "../../theme-provider";
import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "../../ui/dropdown-menu";

const THEME_OPTIONS = [
  { Icon: SunIcon, value: "light" },
  { Icon: MoonIcon, value: "dark" },
  { Icon: MonitorIcon, value: "system" },
] as const;

export const ThemeSwitcherMenu = () => {
  const { setTheme, resolvedTheme, theme } = useTheme();
  const t = useTranslations("core.global.theme");
  const TriggerIcon = resolvedTheme === "dark" ? MoonIcon : SunIcon;

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <TriggerIcon />
        <span>{t("label")}</span>
      </DropdownMenuSubTrigger>

      <DropdownMenuSubContent className="min-w-36">
        <DropdownMenuRadioGroup onValueChange={setTheme} value={theme}>
          {THEME_OPTIONS.map(({ Icon, value }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon />
              <span>{t(value)}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
};
