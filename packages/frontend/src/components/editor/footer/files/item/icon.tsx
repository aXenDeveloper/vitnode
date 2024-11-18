import { Loader } from '@/components/ui/loader';
import { File, FileWarningIcon } from 'lucide-react';
import Image from 'next/image';

export const IconItemListFilesFooterEditor = ({
  alt,
  isLoading,
  src,
  isError,
}: {
  alt: string;
  isError: boolean;
  isLoading: boolean;
  src: null | string;
}) => {
  if (isLoading) {
    return <Loader />;
  }

  if (isError) {
    return <FileWarningIcon className="text-destructive size-8" />;
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
