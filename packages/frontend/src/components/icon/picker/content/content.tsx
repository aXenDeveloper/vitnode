import { CONFIG } from '@/helpers/config-with-env';
import { useTranslations } from 'next-intl';
import React from 'react';

import { Input } from '../../../ui/input';
import { Loader } from '../../../ui/loader';
import { Tabs, TabsTrigger } from '../../../ui/tabs';
import { SkinSelectEmojisContentIconInput } from './emojis/skin-select';

// import { SkinSelectEmojiButtonEditor } from "@/components/editor/toolbar/buttons/emoji/skin-select";

const EmojisContentIconInput = React.lazy(async () =>
  import('./emojis/emojis').then(module => ({
    default: module.EmojisContentIconInput,
  })),
);

const IconsContentIconInput = React.lazy(async () =>
  import('./icons/icons').then(module => ({
    default: module.IconsContentIconInput,
  })),
);

export interface IconPickerProps {
  onChange: (icon: string | undefined) => void;
  setOpen: (open: boolean) => void;
  value: string | undefined;
}

enum Tab {
  Emoji = 'emoji',
  Icon = 'icon',
}

export const ContentIconInput = (props: IconPickerProps) => {
  const t = useTranslations('core.global.icon_picker');
  const [search, setSearch] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<Tab>(Tab.Icon);
  const localStorageSkinToneIndex = localStorage.getItem(
    CONFIG.local_storage.editor_skin_tone,
  );
  const [skinToneIndex, setSkinToneIndex] = React.useState(
    localStorageSkinToneIndex ? +localStorageSkinToneIndex : 0,
  );

  return (
    <>
      <div className="bg-popover sticky top-0 z-10 flex flex-col gap-3 p-4">
        <Tabs>
          <TabsTrigger
            active={activeTab === Tab.Icon}
            id={Tab.Icon}
            onClick={() => {
              setActiveTab(Tab.Icon);
            }}
          >
            {t('icons.title')}
          </TabsTrigger>
          <TabsTrigger
            active={activeTab === Tab.Emoji}
            id={Tab.Emoji}
            onClick={() => {
              setActiveTab(Tab.Emoji);
            }}
          >
            {t('emojis.title')}
          </TabsTrigger>
        </Tabs>

        <div className="flex gap-2">
          <Input
            className="h-9"
            onChange={e => {
              setSearch(e.target.value);
            }}
            placeholder={t(
              activeTab === Tab.Icon
                ? 'icons.placeholder'
                : 'emojis.placeholder',
            )}
            value={search}
          />

          {activeTab === Tab.Emoji && (
            <SkinSelectEmojisContentIconInput
              setSkinToneIndex={setSkinToneIndex}
              skinToneIndex={skinToneIndex}
            />
          )}
        </div>
      </div>

      <div className="max-h-64 p-4 pt-0">
        <React.Suspense fallback={<Loader />}>
          {activeTab === Tab.Icon ? (
            <IconsContentIconInput search={search} {...props} />
          ) : (
            <EmojisContentIconInput
              search={search}
              skinToneIndex={skinToneIndex}
              {...props}
            />
          )}
        </React.Suspense>
      </div>
    </>
  );
};
