'use client';

import { ImgFromApi } from '@/components/img-from-api';
import { acceptMimeTypeImage } from '@/helpers/files-support';
import { formatBytes } from '@/helpers/format-bytes';
import { File } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { CONFIG } from '../../../helpers/config-with-env';
import { Button } from '../../ui/button';

export const FileDownloadButton = ({
  allowDownloadAttachments,
  dir_folder,
  file_alt,
  file_name,
  file_name_original,
  file_size,
  height,
  id,
  mimetype,
  security_key,
  width,
}: {
  allowDownloadAttachments?: boolean;
  dir_folder: string;
  file_alt?: string;
  file_name: string;
  file_name_original: string;
  file_size: number;
  height?: number;
  id: number;
  mimetype: string;
  security_key?: string;
  width?: number;
}) => {
  const t = useTranslations('core.global.editor.files');

  if (acceptMimeTypeImage.includes(mimetype) && width && height) {
    return (
      <span className="inline-block">
        <ImgFromApi
          alt={file_alt ?? file_name_original}
          className="h-auto w-full"
          dir_folder={dir_folder}
          file_name={file_name}
          height={height}
          mimetype={mimetype}
          sizes="100vw"
          width={width}
        />
      </span>
    );
  }

  if (!allowDownloadAttachments) {
    return (
      <Button
        className="bg-muted h-auto max-w-full gap-5 px-5 py-2 text-left [&>svg]:size-7"
        disabled
        variant="outline"
      >
        <File className="text-muted-foreground" />
        <div className="text-muted-foreground text-sm">
          <span>{t('access_denied_download')}</span>
        </div>
      </Button>
    );
  }

  return (
    <Button
      className="bg-muted h-auto gap-5 px-5 py-2 text-left [&>svg]:size-7"
      onClick={() => {
        if (!security_key) return;

        window.open(
          `${CONFIG.backend_url}/secure_files/${id}?security_key=${security_key}`,
          '_blank',
        );
      }}
      variant="outline"
    >
      <File className="text-muted-foreground" />
      <div className="min-w-0 flex-1 overflow-hidden truncate">
        <span className="leading-tight">{file_name_original}</span>
        <div className="text-muted-foreground space-x-2 text-sm">
          <span>{formatBytes(file_size)}</span>
          <span>&middot;</span>
          <span>{mimetype}</span>
        </div>
      </div>
    </Button>
  );
};
