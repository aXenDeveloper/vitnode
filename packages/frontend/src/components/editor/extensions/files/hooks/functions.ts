import { StringLanguage } from '@/graphql/types';
import { JSONContent } from '@tiptap/react';

import { FileStateEditor } from '../files';

export const getFilesFromContent = (
  content: StringLanguage[],
): FileStateEditor[] => {
  const files: FileStateEditor[] = [];

  content.forEach(item => {
    const parseValue: JSONContent[] = JSON.parse(item.value).content;

    const mapContent = (values: JSONContent[]) => {
      values.forEach(value => {
        // Get all file ids
        if (
          value.type === 'files' &&
          value.attrs?.id &&
          !files.find(file => file.id === value.attrs?.id)
        ) {
          files.push({
            id: value.attrs.id,
            isLoading: false,
            file: undefined,
            data: {
              extension: value.attrs.extension,
              file_name: value.attrs.file_name,
              file_size: value.attrs.file_size,
              mimetype: value.attrs.mimetype,
              id: value.attrs.id,
              height: value.attrs.height,
              width: value.attrs.width,
              dir_folder: value.attrs.dir_folder,
              security_key: value.attrs.security_key,
              file_alt: value.attrs.file_alt,
              file_name_original: value.attrs.file_name_original,
            },
          });
        }

        if (value.content) {
          mapContent(value.content);
        }
      });
    };

    mapContent(parseValue);
  });

  return files;
};
