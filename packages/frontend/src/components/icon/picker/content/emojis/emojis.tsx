import { Button } from '@/components/ui/button';
import { cn } from '@/helpers/classnames';
import emojiMartData, { Emoji, EmojiMartData } from '@emoji-mart/data';
import { init, SearchIndex } from 'emoji-mart';
import { useTranslations } from 'next-intl';
import React from 'react';

import { IconPickerProps } from '../content';

interface Props extends Omit<IconPickerProps, 'setOpen'> {
  classNameHeaders?: string;
  search: string;
  setOpen?: (open: boolean) => void;
  skinToneIndex: number;
}

const emojiMart = emojiMartData as EmojiMartData;

void init({ data: emojiMartData });

export const EmojisContentIconInput = ({
  classNameHeaders,
  onChange,
  search,
  setOpen,
  skinToneIndex,
  value,
}: Props) => {
  const t = useTranslations('core.global');
  const [searchResults, setSearchResults] = React.useState<null | string[]>(
    null,
  );

  const setResults = async (value: string) => {
    if (!value) {
      setSearchResults(null);

      return;
    }

    const emojis: Emoji[] = await SearchIndex.search(value);
    setSearchResults(emojis.map(emoji => emoji.id));
  };

  React.useEffect(() => {
    void setResults(search);
  }, [search]);

  if (search) {
    return (
      <>
        <div
          className={cn(
            'bg-popover/80 sticky top-[7.5rem] pb-2 text-sm backdrop-blur',
            classNameHeaders,
          )}
        >
          {t('search_results')}
        </div>
        <div className="pb-3 pt-1">
          {searchResults?.length === 0 ? (
            <div className="text-muted-foreground p-2">{t('no_results')}</div>
          ) : (
            searchResults?.map(id => {
              const emoji = emojiMart.emojis[id];

              const icon =
                emoji.skins.length > skinToneIndex
                  ? emoji.skins[skinToneIndex].native
                  : emoji.skins[0].native;

              return (
                <Button
                  ariaLabel={emoji.name}
                  className="size-9 text-2xl"
                  key={`search_${id}`}
                  onClick={() => {
                    if (value === icon) {
                      onChange('');
                      setOpen?.(false);

                      return;
                    }

                    onChange(icon);
                    setOpen?.(false);
                  }}
                  size="icon"
                  variant={value === icon ? 'default' : 'ghost'}
                >
                  {icon}
                </Button>
              );
            })
          )}
        </div>
      </>
    );
  }

  return (
    <div>
      {emojiMart.categories.map(category => (
        <div key={category.id}>
          <div
            className={cn(
              'bg-popover/80 sticky top-[7.5rem] pb-2 text-sm backdrop-blur',
              classNameHeaders,
            )}
          >
            {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
            {/* @ts-expect-error */}
            {t(`editor.emoji.categories.${category.id}`)}
          </div>
          <div className="pb-3 pt-1">
            {category.emojis.map(id => {
              const emoji = emojiMart.emojis[id];

              const icon =
                emoji.skins.length > skinToneIndex
                  ? emoji.skins[skinToneIndex].native
                  : emoji.skins[0].native;

              return (
                <Button
                  ariaLabel={emoji.name}
                  className="size-9 text-2xl"
                  key={`${id}_${category.id}`}
                  onClick={() => {
                    if (value === icon) {
                      onChange('');
                      setOpen?.(false);

                      return;
                    }

                    onChange(icon);
                    setOpen?.(false);
                  }}
                  size="icon"
                  variant={value === icon ? 'default' : 'ghost'}
                >
                  {icon}
                </Button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
