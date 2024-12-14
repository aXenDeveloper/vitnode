import { useEditorState } from '@/components/editor/hooks/use-editor-state';
import { Button } from '@/components/ui/button';
import { cn } from '@/helpers/classnames';
import { CONFIG } from '@/helpers/config-with-env';
import { formatBytes } from '@/helpers/format-bytes';
import { JSONContent } from '@tiptap/react';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { StringLanguage } from 'vitnode-shared/string-language.dto';

import { IconItemListFilesFooterEditor } from './icon';
import { ItemListFilesFooterEditor } from './item';

export const ContentItemListFilesFooterEditor = ({
  data,
  file,
  isLoading,
  error,
  id,
}: React.ComponentProps<typeof ItemListFilesFooterEditor>) => {
  const t = useTranslations('core.global.editor.files');
  const tCore = useTranslations('core.global');
  const { editor, onChange, selectedLanguage, value, onRemoveFile } =
    useEditorState();

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
      if (!values) return [];

      return values.reduce((acc: JSONContent[], value: JSONContent) => {
        if (value.type === 'fileNode' && Number(value.attrs?.id) === file_id) {
          return acc;
        }

        if (value.content) {
          value.content = mapContent(value.content);
        }

        acc.push(value);

        return acc;
      }, []);
    };

    const valueReturn = {
      ...parseValue,
      content: mapContent(parseValue.content),
    };

    return JSON.stringify(valueReturn);
  };

  return (
    <>
      <div className="flex items-center gap-2 overflow-hidden sm:gap-4">
        <div
          className={cn(
            'relative flex size-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg',
            {
              'h-10 w-14 sm:h-14 sm:w-20':
                data?.width && data.height && !isLoading,
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

          {error ? (
            <span className="text-destructive text-sm">{error}</span>
          ) : (
            <div className="text-muted-foreground flex flex-wrap justify-start gap-x-2 text-sm">
              {isLoading ? (
                t('state.loading')
              ) : (
                <>
                  <span>{formatBytes(file?.size ?? data?.file_size ?? 0)}</span>
                  <span>{file?.type ?? data?.mimetype ?? 'Error!'}</span>
                  {data?.width && data.height && (
                    <span>
                      {data.width}x{data.height}
                    </span>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {!isLoading && (
        <div className="flex shrink-0 flex-wrap items-center justify-center gap-1">
          {data && (
            <Button
              onClick={() => {
                editor.commands.insertFileIntoContent(data);
                editor.commands.focus();
              }}
              variant="ghost"
            >
              <PlusIcon /> {t('insert')}
            </Button>
          )}
          <Button
            ariaLabel={tCore('delete')}
            onClick={() => {
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

              onRemoveFile({ id });
            }}
            size="icon"
            variant="destructiveGhost"
          >
            <Trash2Icon />
          </Button>
        </div>
      )}
    </>
  );
};
