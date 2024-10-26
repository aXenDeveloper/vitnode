'use client';

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Loader } from '@/components/ui/loader';
import { SearchIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { useDebouncedCallback } from 'use-debounce';

export const SearchSidebarAdmin = () => {
  const t = useTranslations('admin.global.search');
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(open => !open);
      }
    };
    document.addEventListener('keydown', down);

    return () => {
      document.removeEventListener('keydown', down);
    };
  }, []);

  const handleSearchInput = useDebouncedCallback((value: string) => {
    if (value.length >= 3 || value.length === 0) {
      setSearch(value);
    }
  }, 500);

  return (
    <>
      <button
        className="bg-secondary/50 text-muted-foreground hover:bg-accent hover:text-accent-foreground flex w-full items-center gap-2 rounded-lg border p-1.5 text-sm transition-colors max-md:hidden"
        data-search-full=""
        onClick={() => {
          setOpen(true);
        }}
        type="button"
      >
        <SearchIcon className="ms-1 size-4" />
        {t('placeholder')}
        <div className="ms-auto inline-flex gap-0.5">
          <kbd className="bg-background rounded-md border px-1.5">⌘</kbd>
          <kbd className="bg-background rounded-md border px-1.5">K</kbd>
        </div>
      </button>

      <CommandDialog onOpenChange={setOpen} open={open}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Suggestions">
            <CommandItem>Calendar</CommandItem>
            <CommandItem>Search Emoji</CommandItem>
            <CommandItem>Calculator</CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
};
