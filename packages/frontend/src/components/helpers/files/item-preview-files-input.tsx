import { FilesInputValue } from '@/components/ui/file-input';
import { cn } from '@/helpers/classnames';
import { CONFIG } from '@/helpers/config-with-env';
import { Trash2 } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import React from 'react';

import { acceptMimeTypeImage } from '../../../helpers/files-support';

export const ItemPreviewFilesInput = ({
  file,
  index,
  onChange,
  value,
  showInfo,
  multiple,
}: {
  file: FilesInputValue;
  index: number;
  multiple?: boolean;
  onChange: (e: FilesInputValue[]) => void;
  showInfo?: boolean;
  value: FilesInputValue[];
}) => {
  const t = useTranslations('core.global');

  const size = React.useMemo(() => {
    const sizeInBytes = file instanceof File ? file.size : file.file_size;
    const sizeInKb = sizeInBytes / 1024;
    if (sizeInBytes < 2048) return `${Math.ceil(sizeInKb)} KB`;

    const sizeInMb = sizeInKb / 1024;
    if (sizeInMb < 1024) return `${sizeInMb.toFixed(2)} MB`;

    const sizeInGb = sizeInMb / 1024;

    return `${sizeInGb.toFixed(2)} GB`;
  }, [file]);

  const handleRemoveFile = () => {
    if (!value) return;

    if (multiple) {
      onChange(value.filter((_, i) => i !== index));

      return;
    }

    onChange([]);
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
          <Image
            alt={file instanceof File ? file.name : file.file_name_original}
            className="object-contain"
            fill
            sizes="100px"
            src={
              file instanceof File
                ? URL.createObjectURL(file)
                : `${CONFIG.backend_public_url}/${file.dir_folder}/${file.file_name}`
            }
          />
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
