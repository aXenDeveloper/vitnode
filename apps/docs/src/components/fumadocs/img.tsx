import { ImageZoom } from 'fumadocs-ui/components/image-zoom';
import { cn } from 'fumadocs-ui/utils/cn';
import React from 'react';

export const ImgDocs = ({
  className,
  ...props
}: React.ComponentProps<typeof ImageZoom>) => {
  return (
    <ImageZoom
      className={cn('rounded-lg border shadow-lg', className)}
      {...props}
    />
  );
};
