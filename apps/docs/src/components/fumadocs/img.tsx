import { ImageZoom } from 'fumadocs-ui/components/image-zoom';
import { cn } from 'fumadocs-ui/utils/cn';
import React from 'react';

export const ImgDocs = ({
  className,
  ...props
}: React.ComponentProps<typeof ImageZoom>) => {
  return (
    <div
      className={cn(
        'from-fd-primary/10 flex items-center justify-center rounded-xl border bg-gradient-to-br *:max-w-[16rem]',
        className,
      )}
    >
      <ImageZoom className="rounded-lg" {...props} />
    </div>
  );
};
