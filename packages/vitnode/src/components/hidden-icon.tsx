import { cn } from "cn";
import { EyeOffIcon } from "lucide-react";

import { TooltipWithContent } from "@/components/ui/tooltip";

export const HiddenIcon = ({
  className,
  focusable = true,
  label,
}: {
  className?: string;
  focusable?: boolean;
  label: string;
}) => (
  <TooltipWithContent text={label}>
    <span
      aria-label={label}
      className={cn(
        "text-warn focus-visible:ring-ring/50 inline-flex shrink-0 rounded-sm outline-none focus-visible:ring-3",
        className,
      )}
      role="img"
      tabIndex={focusable ? 0 : undefined}
    >
      <EyeOffIcon aria-hidden className="size-full" />
    </span>
  </TooltipWithContent>
);
