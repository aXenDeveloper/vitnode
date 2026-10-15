import { useQuery } from "@tanstack/react-query";
import { PuzzleIcon } from "lucide-react";
import React from "react";

import type { PluginIconLoader } from "@/lib/plugin-metadata";

import { installedPluginsQueryKey } from "./plugins-query";

const FRAME =
  "bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg";

/**
 * The plugin's icon, or a puzzle piece while it loads, when the plugin ships
 * none, and when the image fails to decode.
 *
 * Always an `<img>`, never inlined markup: an SVG icon rendered as an image
 * cannot run scripts or reach the network. Decorative, because the title sits
 * right next to it.
 */
export const PluginIcon = ({
  id,
  load,
}: {
  id: string;
  load: PluginIconLoader | undefined;
}) => {
  const { data } = useQuery({
    enabled: load !== undefined,
    queryFn: async () => (load ? (await load()).default : null),
    queryKey: [...installedPluginsQueryKey, "icon", id],
    retry: false,
    staleTime: Infinity,
  });
  const [failed, setFailed] = React.useState<null | string>(null);

  if (!data || failed === data) {
    return (
      <span aria-hidden="true" className={FRAME}>
        <PuzzleIcon className="size-5" />
      </span>
    );
  }

  return (
    <span className={FRAME}>
      <img
        alt=""
        className="size-8 object-contain"
        decoding="async"
        height={32}
        onError={() => {
          setFailed(data);
        }}
        src={data}
        width={32}
      />
    </span>
  );
};
