import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  commandInputClassName,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { cn } from '@/helpers/classnames';
import { usePathname, useRouter } from '@/navigation';
import { Search } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import React from 'react';
import { useDebouncedCallback } from 'use-debounce';

import { useFilterToolbarDataTable } from '../hooks/use-filter-toolbar-data-table';
import { ListContentFilterToolbarDataTable } from './list';

export interface ContentFilterToolbarDataTableProps {
  isFetching?: boolean;
  options: {
    icon?: React.ComponentType<{ className?: string }>;
    label: string;
    value: string;
  }[];
  searchOnChange?: (value: string) => void;
}

export const ContentFilterToolbarDataTable = ({
  searchOnChange,
  ...props
}: ContentFilterToolbarDataTableProps) => {
  const t = useTranslations('core.global');
  const { id, title } = useFilterToolbarDataTable();
  const searchParams = useSearchParams();
  const selectedValues = searchParams.getAll(id);
  const { push } = useRouter();
  const pathname = usePathname();

  const handleSearchInput = useDebouncedCallback((value: string) => {
    if (!searchOnChange) return;

    searchOnChange(value);
  }, 500);

  return (
    <Command>
      {searchOnChange ? (
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 size-4 shrink-0 opacity-50" />
          <Input
            className={cn(
              commandInputClassName,
              'border-0 px-0 focus-visible:ring-0 focus-visible:ring-offset-0',
            )}
            onChange={e => handleSearchInput(e.target.value)}
            placeholder={title}
          />
        </div>
      ) : (
        <CommandInput placeholder={title} />
      )}

      <CommandList>
        {!searchOnChange && <CommandEmpty>{t('no_results')}</CommandEmpty>}

        <CommandGroup>
          <ListContentFilterToolbarDataTable {...props} />
        </CommandGroup>

        {selectedValues.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                className="justify-center text-center"
                onSelect={() => {
                  push(pathname, { scroll: false });
                }}
              >
                {t('clear')}
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </Command>
  );
};
