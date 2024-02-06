import { useState } from 'react';
import * as Accordion from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';

import { useSession } from '@/hooks/core/use-session';
import { cx } from '@/functions/classnames';
import { ItemNavDrawerQuickMenu } from './item';
import { useTextLang } from '@/hooks/core/use-text-lang';
import { buttonVariants } from '@/components/ui/button';
import { classNameDrawerQuickMenu } from '../drawer';

export const NavDrawerQuickMenu = () => {
  const { nav, session } = useSession();
  const [activeItems, setActiveItems] = useState<string[]>([]);
  const { convertText } = useTextLang();

  return (
    <Accordion.Root
      type="multiple"
      defaultValue={activeItems}
      className={cx('px-2 flex flex-col', {
        'pb-5': !session
      })}
    >
      {nav.map(item => {
        if (item.children.length > 0) {
          return (
            <Accordion.Item key={item.id} value={item.id.toString()}>
              <Accordion.Header>
                <Accordion.Trigger
                  className={cx(
                    buttonVariants({
                      variant: 'ghost',
                      className: cx(classNameDrawerQuickMenu, 'focus:bg-inherit')
                    })
                  )}
                  onClick={() =>
                    setActiveItems(prev =>
                      prev.includes(item.id.toString())
                        ? prev.filter(el => el !== item.id.toString())
                        : [...prev, item.id.toString()]
                    )
                  }
                >
                  <span>{convertText(item.name)}</span>
                  <ChevronDown
                    className={cx('w-5 h-5 ml-auto transition-transform flex-shrink-0', {
                      'transform rotate-180': activeItems.includes(item.id.toString())
                    })}
                  />
                </Accordion.Trigger>
              </Accordion.Header>

              <Accordion.Content className="transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
                <div className="pl-5">
                  {item.children.map(child => (
                    <ItemNavDrawerQuickMenu key={child.id} {...child} />
                  ))}
                </div>
              </Accordion.Content>
            </Accordion.Item>
          );
        }

        return <ItemNavDrawerQuickMenu key={item.id} {...item} />;
      })}
    </Accordion.Root>
  );
};