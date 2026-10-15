import { PuzzleIcon } from "lucide-react";

import { DynamicIcon } from "@/components/ui/dynamic-icon";

/**
 * The plugin's Lucide icon, or a puzzle piece while it loads, when the plugin
 * names none and when Lucide has no icon by that name. Decorative, because the
 * title sits right next to it.
 */
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
