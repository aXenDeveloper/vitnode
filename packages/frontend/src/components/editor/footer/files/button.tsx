import { Paperclip } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React from 'react';

import { Button } from '../../../ui/button';
import { useEditorState } from '../../hooks/use-editor-state';

export const FilesButtonFooterEditor = () => {
  const t = useTranslations('core.global.editor.files');
  const ref = React.useRef<HTMLInputElement>(null);
  const { editor } = useEditorState();

  return (
    <>
      <Button onClick={() => ref.current?.click()} variant="ghost">
        <Paperclip /> {t('attach')}
      </Button>
      <input
        className="hidden"
        multiple
        onChange={e => {
          editor.commands.uploadFiles([...(e.target.files ?? [])]);
        }}
        ref={ref}
        type="file"
        value=""
      />
    </>
  );
};
