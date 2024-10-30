import { EmojisContentIconInput } from '@/components/icon/picker/content/emojis/emojis';
import { SkinSelectEmojisContentIconInput } from '@/components/icon/picker/content/emojis/skin-select';
import { useTranslations } from 'next-intl';
import React from 'react';
import { Input } from 'vitnode-frontend/components/ui/input';
import { CONFIG } from 'vitnode-frontend/helpers/config-with-env';

import { useEditorState } from '../../../hooks/use-editor-state';

export const ContentEmojiToolbarEditor = ({
  setIsOpen,
}: {
  setIsOpen?: (open: boolean) => void;
}) => {
  const t = useTranslations('core.global.icon_picker');
  const { editor } = useEditorState();
  const [search, setSearch] = React.useState('');
  const localStorageSkinToneIndex = localStorage.getItem(
    CONFIG.local_storage.editor_skin_tone,
  );
  const [skinToneIndex, setSkinToneIndex] = React.useState(
    localStorageSkinToneIndex ? +localStorageSkinToneIndex : 0,
  );

  return (
    <>
      <div className="bg-popover sticky top-0 z-10 flex flex-col gap-3 p-4">
        <div className="flex gap-2">
          <Input
            className="h-9"
            onChange={e => {
              setSearch(e.target.value);
            }}
            placeholder={t('emojis.placeholder')}
            value={search}
          />

          <SkinSelectEmojisContentIconInput
            setSkinToneIndex={setSkinToneIndex}
            skinToneIndex={skinToneIndex}
          />
        </div>
      </div>

      <div className="max-h-64 p-4 pt-0">
        <EmojisContentIconInput
          classNameHeaders="top-[4rem]"
          onChange={emoji => {
            if (!emoji) return;

            editor.commands.insertContent(emoji);
            setIsOpen?.(false);
          }}
          search={search}
          skinToneIndex={skinToneIndex}
          value=""
        />
      </div>
    </>
  );
};
