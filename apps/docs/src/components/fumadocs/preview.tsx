import { Loader } from '@vitnode/core/components/ui/loader';
import React from 'react';

export const Preview = ({ name }: { name: string }) => {
  const Component = React.lazy(() => import(`../../examples/${name}.tsx`));

  return (
    <div className="from-fd-primary/10 flex items-center justify-center rounded-xl border bg-gradient-to-br p-4 *:max-w-[16rem]">
      <React.Suspense fallback={<Loader />}>
        <Component />
      </React.Suspense>
    </div>
  );
};
