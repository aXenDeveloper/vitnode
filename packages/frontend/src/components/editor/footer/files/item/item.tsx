import { cn } from '@/helpers/classnames';

import { FilesHandlerStorage } from '../../../extensions/files/files';
import { ContentItemListFilesFooterEditor } from './content';

export const ItemListFilesFooterEditor = ({
  error,
  ...props
}: FilesHandlerStorage) => {
  // const handleDelete = ({
  //   content,
  //   file_id,
  // }: {
  //   content: string;
  //   file_id: number;
  // }): string => {
  //   const parseValue: { content: JSONContent[]; type: string } =
  //     JSON.parse(content);

  //   const mapContent = (values: JSONContent[]): JSONContent[] => {
  //     return values.filter(value => {
  //       if (value.type === 'files' && value.attrs?.id === file_id) {
  //         return false;
  //       }
  //       if (value.content) {
  //         value.content = mapContent(value.content);
  //       }

  //       return true;
  //     });
  //   };

  //   const valueReturn = {
  //     ...parseValue,
  //     content: mapContent(parseValue.content),
  //   };

  //   return JSON.stringify(valueReturn);
  // };

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
