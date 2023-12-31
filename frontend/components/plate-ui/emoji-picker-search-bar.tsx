import { type ReactNode } from 'react';
import { type UseEmojiPickerType } from '@udecode/plate-emoji';

export type EmojiPickerSearchBarProps = {
  children: ReactNode;
} & Pick<UseEmojiPickerType, 'i18n' | 'searchValue' | 'setSearch'>;

export function EmojiPickerSearchBar({
  children,
  i18n,
  searchValue,
  setSearch
}: EmojiPickerSearchBarProps) {
  return (
    <div className="flex items-center px-2">
      <div className="relative flex grow">
        <input
          type="text"
          placeholder={i18n.search}
          autoComplete="off"
          aria-label="Search"
          className="block w-full appearance-none rounded-lg border-0 bg-gray-100 px-8 py-2 outline-none"
          onChange={event => setSearch(event.target.value)}
          value={searchValue}
        />
        {children}
      </div>
    </div>
  );
}
