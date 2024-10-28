import { Button } from '@/components/ui/button';
import { usePathname, useRouter } from '@/navigation';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import React from 'react';

export const HeaderDataTable = ({
  children,
  columnId,
  defaultSortingDirection,
}: {
  children: React.ReactNode;
  columnId: string;
  defaultSortingDirection?: 'asc' | 'desc';
}) => {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { push } = useRouter();

  const icon = () => {
    const getSortDirectionIcon = (direction: string) => {
      return direction === 'asc' ? <ArrowUp /> : <ArrowDown />;
    };

    const sortBy = searchParams.get('sortBy');
    const sortDirection = searchParams.get('sortDirection');

    if (defaultSortingDirection && !sortBy) {
      return getSortDirectionIcon(defaultSortingDirection);
    }

    if (columnId === sortBy && sortDirection) {
      return getSortDirectionIcon(sortDirection);
    }

    return <ArrowUpDown />;
  };

  return (
    <Button
      className="-ml-3"
      onClick={() => {
        const params = new URLSearchParams(searchParams);
        params.set('sortBy', columnId);

        const sortDirection = () => {
          if (
            columnId === searchParams.get('sortBy') &&
            searchParams.get('sortDirection')
          ) {
            return searchParams.get('sortDirection') === 'asc' ? 'desc' : 'asc';
          }

          return defaultSortingDirection === 'desc' ? 'asc' : 'desc';
        };
        params.set('sortDirection', sortDirection());
        params.delete('cursor');
        params.delete('first');
        params.delete('last');

        push(`${pathname}?${params.toString()}`);
      }}
      size="sm"
      variant="ghost"
    >
      {children}
      {icon()}
    </Button>
  );
};
