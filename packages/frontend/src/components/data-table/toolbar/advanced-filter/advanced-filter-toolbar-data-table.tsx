import { Filter } from 'lucide-react';
import React from 'react';

import { Button } from '../../../ui/button';
import { Loader } from '../../../ui/loader';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../../../ui/sheet';

export const AdvancedFilterToolbarDataTable = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          // TODO: Add translations
          ariaLabel={'Filters'}
          className="ml-auto"
          size="icon"
          variant="outline"
        >
          <Filter />
        </Button>
      </SheetTrigger>

      <SheetContent>
        <SheetHeader>
          <SheetTitle>{'Filters'}</SheetTitle>
        </SheetHeader>

        <React.Suspense fallback={<Loader />}>{children}</React.Suspense>
      </SheetContent>
    </Sheet>
  );
};
