import type React from "react";

import { ImageZoom } from "fumadocs-ui/components/image-zoom";
import { cn } from "fumadocs-ui/utils/cn";

export const ImgDocs = ({
  className,
  imgClassName,
  ...props
}: React.ComponentProps<typeof ImageZoom> & {
  imgClassName?: string;
}) => {
  return (
    <div
      className={cn(
        "from-fd-primary/10 flex items-center justify-center rounded-xl border bg-gradient-to-br *:max-w-[26rem]",
        className,
      )}
    >
      <ImageZoom className={cn("rounded-lg", imgClassName)} {...props} />
    </div>
  );
};
