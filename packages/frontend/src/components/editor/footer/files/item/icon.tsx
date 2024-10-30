import { Loader } from '@/components/ui/loader';
import { CircleX, File } from 'lucide-react';
import Image from 'next/image';

export const IconItemListFilesFooterEditor = ({
  alt,
  isError,
  isLoading,
  src,
}: {
  alt: string;
  isError: boolean | undefined;
  isLoading: boolean;
  src: null | string;
}) => {
  if (isLoading) {
    return <Loader />;
  }

  if (isError) {
    return <CircleX className="text-destructive size-8" />;
  }

  if (src) {
    return (
      <Image
        alt={alt}
        className="object-cover"
        fill
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        src={src}
      />
    );
  }

  return <File className="text-muted-foreground size-8" />;
};
