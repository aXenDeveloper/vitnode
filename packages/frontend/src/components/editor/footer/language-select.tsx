import { useMiddlewareData } from '@/hooks/use-middleware-data';

import { buttonVariants } from '../../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { useEditorState } from '../hooks/use-editor-state';

export interface LanguageSelectFooterEditorProps {
  selectedLanguage: string;
  setSelectedLanguage: (value: string) => void;
}

export const LanguageSelectFooterEditor = ({
  selectedLanguage,
  setSelectedLanguage,
}: LanguageSelectFooterEditorProps) => {
  const { languages: languagesFromGlobal } = useMiddlewareData();
  const { editor } = useEditorState();
  const languages = languagesFromGlobal.filter(
    item => item.allow_in_input && item.enabled,
  );

  return (
    <Select onValueChange={setSelectedLanguage} value={selectedLanguage}>
      <SelectTrigger
        className={buttonVariants({
          variant: 'ghost',
          size: 'sm',
          className: 'w-auto border-0 shadow-none [&>svg]:h-5 [&>svg]:w-5',
        })}
      >
        <SelectValue />
      </SelectTrigger>

      <SelectContent onCloseAutoFocus={() => editor.commands.focus()}>
        {languages.map(language => (
          <SelectItem key={language.code} value={language.code}>
            {language.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
