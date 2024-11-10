import { getMiddlewareData } from '@/api/get-middleware-data';
import { cn } from '@/helpers/classnames';

import { ItemNavHeader } from './item';

export const NavHeader = async ({ className }: { className?: string }) => {
  const { nav } = await getMiddlewareData();

  return (
    <nav
      className={cn(
        'hidden h-full flex-1 items-center gap-1 overflow-x-auto px-6 sm:flex',
        className,
      )}
      style={{
        maskImage:
          'linear-gradient(to right, transparent 2px, white 24px, white calc(100% - 24px), transparent calc(100% - 2px))',
      }}
    >
      {nav.map(item => (
        <ItemNavHeader key={item.id} {...item} />
      ))}
    </nav>
  );
};
