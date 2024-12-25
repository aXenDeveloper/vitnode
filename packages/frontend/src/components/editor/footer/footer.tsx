import { useMiddlewareData } from '@/hooks/use-middleware-data';

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
  disableLanguages = false,
  selectedLanguage,
  setSelectedLanguage,
}: Props) => {
  const { files } = useEditorState();
  const { languages } = useMiddlewareData();
  const enableLanguages = languages.filter(
    lang => lang.enabled && lang.allow_in_input,
  );

  if (!files.length && (enableLanguages.length <= 1 || disableLanguages)) {
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
