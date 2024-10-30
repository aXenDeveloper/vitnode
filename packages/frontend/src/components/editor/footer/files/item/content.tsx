import { formatBytes } from '@/helpers/format-bytes';
import { useTranslations } from 'next-intl';

import { ItemListFilesFooterEditorProps } from './item';

export const ContentItemListFilesFooterEditor = ({
  data,
  error,
  file,
  isLoading,
}: Omit<ItemListFilesFooterEditorProps, 'editor' | 'id' | 'setFiles'>) => {
  const t = useTranslations('core.global.editor.files');

  if (isLoading) {
    return t('state.loading');
  }

  if (error) {
    return (
      <span className="text-destructive">{t('state.error', { error })}</span>
    );
  }

  return (
    <>
      <span>{formatBytes(file?.size ?? data?.file_size ?? 0)}</span>
      <span>{file?.type ?? data?.mimetype ?? 'Error!'}</span>
      {data?.width && data.height && (
        <span>
          {data.width}x{data.height}
        </span>
      )}
    </>
  );
};
