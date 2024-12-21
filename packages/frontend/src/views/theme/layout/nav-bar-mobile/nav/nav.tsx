import { Accordion } from '@/components/ui/accordion';
import { useMiddlewareData } from '@/hooks/use-middleware-data';
import { useTextLang } from '@/hooks/use-text-lang';

import { ItemNavNavBarMobile } from './item';

export const NavNavBarMobile = () => {
  const { convertText } = useTextLang();
  const { nav } = useMiddlewareData();

  return (
    <Accordion asChild type="multiple">
      <nav className="flex flex-col px-2">
        {nav.map(item => (
          <ItemNavNavBarMobile
            childrenItem={item.children}
            href={item.href}
            key={item.id}
            name={convertText(item.name)}
          />
        ))}
      </nav>
    </Accordion>
  );
};
