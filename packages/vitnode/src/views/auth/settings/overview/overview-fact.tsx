import type { LucideIcon } from "lucide-react";

import { cn } from "cn";
import { useTranslations } from "use-intl";

import {
  Item,
  ItemActions,
  ItemContent,
  ItemMedia,
} from "@/components/ui/item";

export const OverviewFact = ({
  badge,
  icon: Icon,
  label,
  value,
}: {
  badge?: React.ReactNode;
  icon: LucideIcon;
  label: string;
  value: null | React.ReactNode;
}) => {
  const t = useTranslations("core.auth.settings.overview");

  return (
    <Item render={<li />}>
      <ItemMedia aria-hidden variant="tile">
        <Icon />
      </ItemMedia>
      <ItemContent className="min-w-0 gap-0">
        <span className="text-muted-foreground text-sm">{label}</span>
        <span
          className={cn(
            "text-sm wrap-anywhere",
            value === null
              ? "text-muted-foreground/70"
              : "text-foreground font-medium",
          )}
        >
          {value ?? t("notSet")}
        </span>
      </ItemContent>
      {badge ? <ItemActions>{badge}</ItemActions> : null}
    </Item>
  );
};
