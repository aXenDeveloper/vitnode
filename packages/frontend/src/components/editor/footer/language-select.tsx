import { useMiddlewareData } from '@/hooks/use-middleware-data';
import { useTranslations } from 'next-intl';

import { buttonVariants } from '../../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../ui/tooltip';
import { useEditorState } from '../hooks/use-editor-state';

export interface LanguageSelectFooterEditorProps {
  selectedLanguage: string;
  setSelectedLanguage: (value: string) => void;
}

export const LanguageSelectFooterEditor = ({
  selectedLanguage,
  setSelectedLanguage,
}: LanguageSelectFooterEditorProps) => {
  const t = useTranslations('core.global.editor');
  const { languages: languagesFromGlobal } = useMiddlewareData();
  const { editor } = useEditorState();
  const languages = languagesFromGlobal.filter(item => item.allow_in_input);

  if (languages.length <= 1) return null;

  return (
    <Select onValueChange={setSelectedLanguage} value={selectedLanguage}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <SelectTrigger
              className={buttonVariants({
                variant: 'ghost',
                size: 'sm',
                className:
                  'w-auto border-0 shadow-none [&>svg]:h-5 [&>svg]:w-5',
              })}
            >
              <SelectValue />
            </SelectTrigger>
          </TooltipTrigger>

          <TooltipContent side="top">{t('change_language')}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

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
