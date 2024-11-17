import { useEditorState } from '../hooks/use-editor-state';
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
  const { files } = useEditorState();

  if (!disableLanguages && !files.length) {
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
      </div>

      {files.length > 0 && <ListFilesFooterEditor />}
    </div>
  );
};
