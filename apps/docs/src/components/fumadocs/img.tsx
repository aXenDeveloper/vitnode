import type React from "react";

import { cn } from "@vitnode/core/lib/utils";
import { ImageZoom } from "fumadocs-ui/components/image-zoom";

export const ImgDocs = ({
  className,
  imgClassName,
  withoutBackground,
  ...props
}: React.ComponentProps<typeof ImageZoom> & {
  imgClassName?: string;
  withoutBackground?: boolean;
}) => {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-xl border",
        {
          "from-fd-primary/10 bg-gradient-to-br *:max-w-[26rem]":
            !withoutBackground,
        },
        {
          "*:max-w-[36rem]": withoutBackground,
        },
        className,
      )}
    >
      <ImageZoom className={cn("rounded-lg", imgClassName)} {...props} />
    </div>
  );
};
