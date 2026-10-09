import { cn } from "cn";
import { SparklesIcon } from "lucide-react";

import { DynamicIcon } from "@/components/ui/dynamic-icon";

export const AiActionIcon = ({
  enabled,
  icon,
}: {
  enabled: boolean;
  icon: null | string;
}) => (
  <span
    aria-hidden
    className={cn(
      "flex size-9 shrink-0 items-center justify-center rounded-md transition-colors",
      enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
    )}
  >
    {icon ? (
      <DynamicIcon
        className="size-4"
        fallback={<SparklesIcon className="size-4" />}
        name={icon}
      />
    ) : (
      <SparklesIcon className="size-4" />
    )}
  </span>
);
