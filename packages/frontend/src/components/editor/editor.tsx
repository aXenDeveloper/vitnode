'use client';

import { fetcherClient } from '@/api/fetcher-client';
import { formatBytes } from '@/helpers/format-bytes';
import { useMiddlewareData } from '@/hooks/use-middleware-data';
import { useSession } from '@/hooks/use-session';
import { useSessionAdmin } from '@/hooks/use-session-admin';
import { Content, EditorContent, useEditor } from '@tiptap/react';
import { useLocale, useTranslations } from 'next-intl';
import React from 'react';
import { toast } from 'sonner';
import { ShowFile, UploadFilesBody } from 'vitnode-shared/files.dto';
import { StringLanguage } from 'vitnode-shared/string-language.dto';

import { cn } from '../../helpers/classnames';
import { Skeleton } from '../ui/skeleton';
import { useExtensionsEditor } from './extensions/extensions';
import { FilesHandlerStorage } from './extensions/files/files';
import { deleteMutationApi } from './extensions/files/hooks/delete-mutation-api';
import { getFilesFromContent } from './extensions/files/hooks/functions';
import { useFilesExtensionEditor } from './extensions/files/hooks/use-files-extension-editor';
import { FooterEditor } from './footer/footer';
import { EditorStateContext } from './hooks/use-editor-state';
import { ToolBarEditor } from './toolbar/toolbar';

export const EditorSkeleton = ({ className }: { className?: string }) => {
  return <Skeleton className={cn('h-32 w-full', className)} />;
};

export const Editor = ({
  allowUploadFiles,
  autofocus,
  className,
  disableLanguages,
  onChange,
  value,
  disabled,
}: {
  allowUploadFiles?: {
    folder: string;
    plugin_code: string;
  };
  autofocus?: boolean;
  className?: string;
  disabled?: boolean;
  disableLanguages?: boolean;
  onChange: (value: StringLanguage[]) => void;
  value: StringLanguage[];
}) => {
  const [files, setFiles] = React.useState<FilesHandlerStorage[]>(
    getFilesFromContent(value),
  );
  const locale = useLocale();
  const t = useTranslations('core.global.editor.files.errors');
  const tCore = useTranslations('core.global.errors');
  const { languages_code_default } = useMiddlewareData();
  const [selectedLanguage, setSelectedLanguage] = React.useState(
    locale || languages_code_default,
  );
  const session = useSession();
  const adminSession = useSessionAdmin();
  const allowUploadFilesSession =
    session.user?.files_permissions.allow_upload ??
    adminSession.user?.files_permissions.allow_upload ??
    false;
  const { validateMimeTypeFile, validateSizeFile } = useFilesExtensionEditor();

  const handleUploadError = (error: Error, tempId: number) => {
    const updateFileError = (message: string) => {
      setFiles(prev =>
        prev.map(f =>
          f.id === tempId ? { ...f, isLoading: false, error: message } : f,
        ),
      );
    };

    if (error.message.includes('MAX_STORAGE_EXTENDED')) {
      const maxStorage = Number(error.message.split('.')[1]);
      updateFileError(
        t('max_storage_extended', { size: formatBytes(maxStorage) }),
      );

      return;
    }

    if (error.message.includes('INVALID_FILE_TYPE')) {
      const fileType = error.message.split('.')[1];
      updateFileError(t('invalid_file_type', { type: fileType }));

      return;
    }

    updateFileError(tCore('internal_server_error'));
  };

  const onUploadFile = async (file: File) => {
    if (!allowUploadFiles) return;
    const tempId = Math.floor(Math.random() * 1000) + file.size;
    let allFiles: FilesHandlerStorage[] = [];

    setFiles(prev => {
      const current: FilesHandlerStorage[] = [
        ...prev,
        {
          id: tempId,
          isLoading: true,
          file,
        },
      ];

      allFiles = current;

      return current;
    });

    try {
      // Validate file
      validateMimeTypeFile(file);
      validateSizeFile({ file, files: allFiles });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('plugin_code', allowUploadFiles.plugin_code);
      formData.append('folder', allowUploadFiles.folder);

      const { data } = await fetcherClient<ShowFile, UploadFilesBody>({
        url: '/core/files',
        method: 'POST',
        body: formData,
      });

      setFiles(prev =>
        prev.map(f =>
          f.id === tempId ? { ...f, isLoading: false, data, id: data.id } : f,
        ),
      );

      return data;
    } catch (err) {
      handleUploadError(err as Error, tempId);
    }
  };

  const onRemoveFile = async ({
    id,
    securityKey,
  }: {
    id: number;
    securityKey?: string;
  }) => {
    try {
      await deleteMutationApi({
        file_id: id,
        security_key: securityKey,
      });
      setFiles(prev => prev.filter(f => f.id !== id));
    } catch (_) {
      toast.error(tCore('title'), {
        description: tCore('internal_server_error'),
      });
    }
  };

  const extensions = useExtensionsEditor({
    filesOptions: {
      onUploadFile,
    },
  });

  const editor = useEditor({
    autofocus: !!autofocus,
    immediatelyRender: false,
    extensions,
    editorProps: {
      attributes: {
        class: cn(
          'bg-card min-h-32 resize-y overflow-auto p-4 focus:outline-none [&>*:not(:last-child)]:mb-[0.5rem]',
        ),
      },
    },
    content: (() => {
      const current = Array.isArray(value)
        ? (value.find(v => v.language_code === selectedLanguage)?.value ?? '')
        : value;

      try {
        return JSON.parse(current);
      } catch (_) {
        return current;
      }
    })(),
    onUpdate({ editor }) {
      const content = JSON.stringify(editor.getJSON());
      const currentValue = Array.isArray(value) ? value : [];

      if (disableLanguages) {
        onChange([{ language_code: selectedLanguage, value: content }]);

        return;
      }

      // Remove form the array if content is empty
      if (editor.isEmpty) {
        onChange(
          currentValue.filter(v => v.language_code !== selectedLanguage),
        );

        return;
      }

      onChange([
        ...currentValue.filter(v => v.language_code !== selectedLanguage),
        { language_code: selectedLanguage, value: content },
      ]);
    },
  });

  // Toggle the editor content when the selected language changes
  React.useEffect(() => {
    if (!editor || disableLanguages || !Array.isArray(value)) return;

    const findValue =
      value.find(v => v.language_code === selectedLanguage)?.value ?? '';
    if (!findValue) {
      editor.commands.clearContent();

      return;
    }

    const content: Content = JSON.parse(findValue);
    editor.commands.setContent(content);
  }, [selectedLanguage]);

  if (!editor) return null;

  return (
    <EditorStateContext.Provider
      value={{
        editor,
        value,
        onChange: onChange as (value: string | StringLanguage[]) => void,
        selectedLanguage,
        files,
        allowUploadFiles: allowUploadFilesSession,
        onUploadFile,
        onRemoveFile,
      }}
    >
      <div
        className={cn(
          'border-input relative rounded-md border shadow-sm',
          className,
          {
            'pointer-events-none cursor-not-allowed opacity-50': disabled,
          },
        )}
      >
        <ToolBarEditor />
        <EditorContent
          className="break-words [&_.ProseMirror-selectednode]:w-fit [&_.node-files]:inline-flex"
          editor={editor}
        />

        <FooterEditor
          disableLanguages={disableLanguages}
          selectedLanguage={selectedLanguage}
          setSelectedLanguage={setSelectedLanguage}
        />
      </div>
    </EditorStateContext.Provider>
  );
};
