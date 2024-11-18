import { cn } from '@/helpers/classnames';

import { FilesHandlerStorage } from '../../../extensions/files/files';
import { ContentItemListFilesFooterEditor } from './content';

export const ItemListFilesFooterEditor = ({
  error,
  ...props
}: FilesHandlerStorage) => {
  return (
    <li
      className={cn(
        'bg-card flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2 shadow-sm transition-colors sm:gap-4 sm:p-4',
        {
          'border-destructive': error,
        },
      )}
    >
      <ContentItemListFilesFooterEditor error={error} {...props} />
    </li>
  );
};
