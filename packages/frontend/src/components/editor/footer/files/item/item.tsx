import { deleteMutationApi } from '@/components/editor/extensions/files/hooks/delete-mutation-api';
import { Button } from '@/components/ui/button';
import { cn } from '@/helpers/classnames';
import { CONFIG } from '@/helpers/config-with-env';
import { JSONContent } from '@tiptap/react';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { StringLanguage } from 'vitnode-shared/string-language.dto';

import { FileStateEditor } from '../../../extensions/files/files';
import { useEditorState } from '../../../hooks/use-editor-state';
import { ContentItemListFilesFooterEditor } from './content';
import { IconItemListFilesFooterEditor } from './icon';

export interface ItemListFilesFooterEditorProps
  extends Omit<FileStateEditor, 'file'> {
  file?: File;
}

export const ItemListFilesFooterEditor = ({
  data,
  error,
  file,
  id,
  isLoading,
}: ItemListFilesFooterEditorProps) => {
  const t = useTranslations('core.global.editor.files');
  const tCore = useTranslations('core.global');
  const { editor, onChange, selectedLanguage, value } = useEditorState();

  const handleDelete = ({
    content,
    file_id,
  }: {
    content: string;
    file_id: number;
  }): string => {
    const parseValue: { content: JSONContent[]; type: string } =
      JSON.parse(content);

    const mapContent = (values: JSONContent[]): JSONContent[] => {
      return values.filter(value => {
        if (value.type === 'files' && value.attrs?.id === file_id) {
          return false;
        }
        if (value.content) {
          value.content = mapContent(value.content);
        }

        return true;
      });
    };

    const valueReturn = {
      ...parseValue,
      content: mapContent(parseValue.content),
    };

    return JSON.stringify(valueReturn);
  };

  return (
    <li
      className={cn(
        'bg-card flex flex-col items-center justify-center gap-2 rounded-lg border p-4 shadow-sm transition-colors sm:flex-row sm:flex-nowrap sm:gap-4',
        {
          'border-destructive': error,
        },
      )}
    >
      <div
        className={cn(
          'relative flex size-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg',
          {
            'h-10 w-14 sm:h-14 sm:w-20':
              data?.width && data.height && !isLoading && !error,
          },
        )}
      >
        <IconItemListFilesFooterEditor
          alt={data?.file_alt ?? data?.file_name ?? file?.name ?? ''}
          isError={!!error}
          isLoading={isLoading}
          src={
            data?.width && data.height
              ? `${CONFIG.backend_public_url}/${data.dir_folder}/${data.file_name}`
              : null
          }
        />
      </div>
      <div className="inline-block w-full min-w-0 flex-1">
        <span className="block truncate leading-tight">
          {file?.name ?? data?.file_name ?? 'Error!'}
        </span>

        <div className="text-muted-foreground flex flex-wrap justify-center gap-x-2 text-sm sm:justify-start">
          <ContentItemListFilesFooterEditor
            data={data}
            error={error}
            file={file}
            isLoading={isLoading}
          />
        </div>
      </div>
      {!isLoading && (
        <div className="flex shrink-0 flex-wrap items-center justify-center gap-1">
          {!error && data && (
            <Button
              onClick={() => {
                editor.commands.insertFileIntoContent(id);
                editor.commands.focus();
              }}
              variant="ghost"
            >
              <Plus /> {t('insert')}
            </Button>
          )}
          <Button
            ariaLabel={tCore('delete')}
            onClick={async () => {
              // Remove files from the editor
              if (Array.isArray(value) && value.length > 0) {
                const content: StringLanguage[] = value.map(item => ({
                  language_code: item.language_code,
                  value: handleDelete({
                    content: item.value,
                    file_id: id,
                  }),
                }));

                onChange(content);

                const parseContent: string = JSON.parse(
                  content.find(item => item.language_code === selectedLanguage)
                    ?.value ?? '',
                );

                editor.commands.clearContent();
                editor.commands.setContent(parseContent);
              } else if (typeof value === 'string') {
                const content = handleDelete({
                  content: value,
                  file_id: id,
                });

                onChange(content);
              }
              editor.commands.deleteFile(id);

              if (data) {
                try {
                  await deleteMutationApi({
                    file_id: id,
                    security_key: data.security_key ?? '',
                  });
                } catch (_) {
                  toast.error(tCore('errors.title'), {
                    description: tCore('errors.internal_server_error'),
                  });
                }
              }
            }}
            size="icon"
            variant="destructiveGhost"
          >
            <Trash2 />
          </Button>
        </div>
      )}
    </li>
  );
};
