import {
  Command,
  CommandGroup,
  commandInputClassName,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Loader } from '@/components/ui/loader';
import { cn } from '@/helpers/classnames';
import { useTextLang } from '@/hooks/use-text-lang';
import { useQuery } from '@tanstack/react-query';
import { Check, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { StringLanguage } from 'vitnode-shared/string-language.dto';

export const ComboboxContentWithFetcher = ({
  queryKey,
  search: isSearch,
  placeholder,
  queryFn,
  multiple,
  value,
  onSelect,
}: {
  multiple?: boolean;
  onSelect: (value: { key: string; value: string | StringLanguage[] }) => void;
  placeholder?: string;
  queryFn: (props: { search: string }) => Promise<
    {
      key: string;
      value: string | StringLanguage[];
      valueWithFormatting?: React.ReactNode;
    }[]
  >;
  queryKey: string;
  search?: boolean;
  value:
    | undefined
    | {
        key: string;
        value: string | StringLanguage[];
      }
    | {
        key: string;
        value: string | StringLanguage[];
      }[];
}) => {
  const t = useTranslations('core.global');
  const [search, setSearch] = React.useState('');
  const { convertText } = useTextLang();
  const { data, isLoading } = useQuery({
    queryKey: [queryKey, { search }],
    queryFn: async () => {
      return await queryFn({ search });
    },
  });

  const handleSearchInput = useDebouncedCallback((value: string) => {
    setSearch(value);
  }, 500);

  const edges = data ?? [];

  return (
    <Command>
      {isSearch && (
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 size-4 shrink-0 opacity-50" />
          <Input
            className={cn(
              'border-0 px-0 focus-visible:ring-0 focus-visible:ring-offset-0',
              commandInputClassName,
            )}
            onChange={e => handleSearchInput(e.target.value)}
            placeholder={placeholder ? placeholder : t('search_placeholder')}
          />
        </div>
      )}

      <CommandList>
        {isLoading ? (
          <Loader className="p-2" />
        ) : edges.length <= 0 ? (
          <div className="py-6 text-center text-sm">{t('no_results')}</div>
        ) : (
          <CommandGroup>
            {edges.map(edge => {
              const currentArrayValues = Array.isArray(value)
                ? value
                : value
                  ? [value]
                  : [];

              return (
                <CommandItem
                  className="gap-2"
                  key={edge.key}
                  onSelect={() => {
                    onSelect({
                      key: edge.key,
                      value: edge.value,
                    });
                  }}
                >
                  {multiple ? (
                    <div
                      className={cn(
                        'border-primary mr-2 flex size-4 items-center justify-center rounded-sm border',
                        currentArrayValues.find(item => item.key === edge.key)
                          ? 'bg-primary text-primary-foreground'
                          : 'opacity-50 [&_svg]:invisible',
                      )}
                    >
                      <Check />
                    </div>
                  ) : (
                    <Check
                      className={cn(
                        'mr-2 size-4',
                        currentArrayValues.find(item => item.key === edge.key)
                          ? 'opacity-100'
                          : 'opacity-0',
                      )}
                    />
                  )}

                  {edge.valueWithFormatting
                    ? edge.valueWithFormatting
                    : Array.isArray(edge.value)
                      ? convertText(edge.value)
                      : edge.value}
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  );
};
