import { ImgFromApi } from '@/components/img';
import { FileInput, FilesInputValue } from '@/components/ui/file-input';
import { cn } from '@/helpers/classnames';
import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import React from 'react';

import { acceptMimeTypeImage } from '../../../helpers/files-support';

export const ItemPreviewFilesInput = ({
  file,
  index,
  onChange,
  value,
  showInfo,
  multiple,
}: Pick<
  React.ComponentProps<typeof FileInput>,
  'multiple' | 'onChange' | 'value'
> & {
  file: FilesInputValue;
  index: number;
  showInfo?: boolean;
}) => {
  const t = useTranslations('core.global');
  const size = React.useMemo(() => {
    const sizeInBytes = file instanceof File ? file.size : file.file_size;
    const sizeInKb = sizeInBytes / 1024;
    if (sizeInKb < 1024) return `${Math.ceil(sizeInKb)} KB`;

    const sizeInMb = sizeInKb / 1024;
    if (sizeInMb < 1024) return `${sizeInMb.toFixed(2)} MB`;

    const sizeInGb = sizeInMb / 1024;

    return `${sizeInGb.toFixed(2)} GB`;
  }, [file]);

  const handleRemoveFile = () => {
    if (!value) return;

    if (multiple) {
      onChange(
        (Array.isArray(value) ? value : [value]).filter(
          (_, i) => i !== index,
        ) as FilesInputValue[] & (FilesInputValue | null),
      );

      return;
    }

    onChange(null as unknown as FilesInputValue[] & (FilesInputValue | null));
  };

  return (
    <li
      className={cn(
        'border-input bg-background relative flex items-start gap-2 rounded-md border p-2',
        {
          'p-4': showInfo,
        },
      )}
    >
      {acceptMimeTypeImage.includes(
        file instanceof File ? file.type : file.mimetype,
      ) && (
        <div
          className={cn('relative shrink-0 rounded-sm', {
            'h-12 w-24': showInfo,
            'size-10': !showInfo,
          })}
        >
          {file instanceof File ? (
            <Image
              alt={file.name}
              className="object-contain"
              fill
              sizes="100px"
              src={URL.createObjectURL(file)}
            />
          ) : (
            <ImgFromApi
              alt={file.file_name_original}
              className="object-contain"
              dir_folder={file.dir_folder}
              file_name={file.file_name}
              fill
              mimetype={file.mimetype}
              sizes="100px"
            />
          )}
        </div>
      )}
      <div className="mr-6 truncate">
        <p className="@xs:text-base truncate text-sm">
          {file instanceof File ? file.name : file.file_name}
        </p>
        <p className="text-muted-foreground @xs:text-sm text-xs">{size}</p>
      </div>
      <button
        className={cn(
          'ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground ml-auto flex size-7 flex-shrink-0 items-center justify-center rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:pointer-events-none',
          {
            'size-8': showInfo,
          },
        )}
        onClick={handleRemoveFile}
        type="button"
      >
        <Trash2 className="size-4" />
        <span className="sr-only">{t('delete')}</span>
      </button>
    </li>
  );
};
