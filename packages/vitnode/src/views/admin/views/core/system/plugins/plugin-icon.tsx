import { PuzzleIcon } from "lucide-react";

import { DynamicIcon } from "@/components/ui/dynamic-icon";

export const PluginIcon = ({ icon }: { icon: null | string }) => {
  const fallback = <PuzzleIcon className="size-5" />;

  return (
    <span
      aria-hidden="true"
      className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-lg"
    >
      {icon === null ? (
        fallback
      ) : (
        <DynamicIcon
          className="size-5"
          fallback={fallback}
          missing={fallback}
          name={icon}
        />
      )}
    </span>
  );
};
