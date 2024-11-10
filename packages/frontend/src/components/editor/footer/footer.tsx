import { useMiddlewareData } from '@/hooks/use-middleware-data';
import { AllowTypeFilesEnum } from 'vitnode-shared/utils/global';

import { FileStateEditor } from '../extensions/files/files';
import { useEditorState } from '../hooks/use-editor-state';
import { FilesButtonFooterEditor } from './files/button';
import { ListFilesFooterEditor } from './files/list';
import {
  LanguageSelectFooterEditor,
  LanguageSelectFooterEditorProps,
} from './language-select';

interface Props extends LanguageSelectFooterEditorProps {
  disableLanguages?: boolean;
}

export const FooterEditor = ({
  disableLanguages,
  selectedLanguage,
  setSelectedLanguage,
}: Props) => {
  const { allowUploadFiles, editor } = useEditorState();
  const files: FileStateEditor[] = editor.storage.files.files;
  const middleware = useMiddlewareData();

  if (!disableLanguages && !allowUploadFiles) {
    return null;
  }

  return (
    <div className="bg-background rounded-b-md p-2">
      <div className="flex w-full flex-wrap items-center justify-between gap-2 [&>*]:w-full [&>*]:sm:w-auto">
        {!disableLanguages && (
          <LanguageSelectFooterEditor
            selectedLanguage={selectedLanguage}
            setSelectedLanguage={setSelectedLanguage}
          />
        )}

        {allowUploadFiles &&
          middleware.editor.files.allow_type !== AllowTypeFilesEnum.none && (
            <FilesButtonFooterEditor />
          )}
      </div>

      {files.length > 0 && <ListFilesFooterEditor />}
    </div>
  );
};
