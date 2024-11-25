import { Accordion } from '@/components/ui/accordion';
import { useMiddlewareData } from '@/hooks/use-middleware-data';

import { ItemNavNavBarMobile } from './item';

export const NavNavBarMobile = () => {
  const { nav } = useMiddlewareData();

  return (
    <Accordion asChild type="multiple">
      <nav className="mb-4 flex flex-col px-2">
        {nav.map(item => (
          <ItemNavNavBarMobile key={item.id} {...item} />
        ))}
      </nav>
    </Accordion>
  );
};
