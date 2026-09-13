import { LanguagesIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import type { LocaleConfig } from "@/lib/i18n/types";

import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "../../ui/dropdown-menu";

interface LanguageSwitcherReadyProps {
  currentLocale: string;
  onSelect: (locale: string) => void;
}

interface LanguageSwitcherPendingProps {
  currentLocale?: never;
  onSelect?: never;
}

export type LanguageSwitcherMenuProps = (
  LanguageSwitcherPendingProps | LanguageSwitcherReadyProps
) & {
  isPending?: boolean;
  options: LocaleConfig[];
};

export const LanguageSwitcherMenu = ({
  currentLocale,
  isPending,
  onSelect,
  options,
}: LanguageSwitcherMenuProps) => {
  const t = useTranslations("core.global");

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger disabled={isPending === true || !onSelect}>
        <LanguagesIcon />
        <span>{t("language")}</span>
      </DropdownMenuSubTrigger>

      <DropdownMenuSubContent className="min-w-36">
        <DropdownMenuRadioGroup value={currentLocale}>
          {options.map(option => (
            <DropdownMenuRadioItem
              key={option.code}
              onClick={() => {
                onSelect?.(option.code);
              }}
              value={option.code}
            >
              {option.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
};
