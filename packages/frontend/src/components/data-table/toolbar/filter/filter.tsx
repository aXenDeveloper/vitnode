import { PlusCircle } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import React from 'react';

import { Badge } from '../../../ui/badge';
import { Button } from '../../../ui/button';
import { Loader } from '../../../ui/loader';
import { Popover, PopoverContent, PopoverTrigger } from '../../../ui/popover';
import { Separator } from '../../../ui/separator';
import { FilterToolbarDataTableContext } from './hooks/use-filter-toolbar-data-table';

export interface FilterToolbarDataTableProps {
  children: React.ReactNode;
  id: string;
  title: string;
}

export function FilterToolbarDataTable({
  children,
  id,
  title,
}: FilterToolbarDataTableProps) {
  const searchParams = useSearchParams();
  const selectedValues = searchParams.getAll(id);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button className="h-10" size="sm" variant="outline">
          <PlusCircle className="mr-2 size-4" />
          {title}
          {selectedValues.length > 0 && (
            <>
              <Separator className="mx-2 h-4" orientation="vertical" />
              <Badge
                className="rounded-sm px-1 font-normal lg:hidden"
                variant="secondary"
              >
                {selectedValues.length}
              </Badge>
              <div className="hidden space-x-1 lg:flex">
                <Badge
                  className="rounded-sm px-1 font-normal"
                  variant="secondary"
                >
                  +{selectedValues.length}
                </Badge>
              </div>
            </>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-56 p-0">
        <FilterToolbarDataTableContext.Provider value={{ title, id }}>
          <React.Suspense fallback={<Loader className="p-4" />}>
            {children}
          </React.Suspense>
        </FilterToolbarDataTableContext.Provider>
      </PopoverContent>
    </Popover>
  );
}
