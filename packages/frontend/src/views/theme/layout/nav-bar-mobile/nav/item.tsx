import { AccordionContent } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { DrawerClose } from '@/components/ui/drawer';
import { cn } from '@/helpers/classnames';
import { useTextLang } from '@/hooks/use-text-lang';
import { Link, usePathname } from '@/navigation';
import { AccordionItem, AccordionTrigger } from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';
import { ShowNavStyles } from 'vitnode-shared/nav.dto';

export const ItemNavNavBarMobile = ({
  name,
  href,
  external,
  children,
  id,
}: ShowNavStyles) => {
  const { convertText } = useTextLang();
  const pathname = usePathname();
  const active = pathname.startsWith(href);
  const text = convertText(name);

  if (children.length > 0) {
    return (
      <AccordionItem value={`nav-mobile-${id}`}>
        <AccordionTrigger asChild>
          <Button
            className={cn(
              'w-full max-w-full justify-start text-left font-normal [&[data-state=open]>svg]:rotate-180',
              {
                'text-muted-foreground': !active,
              },
            )}
            variant={active ? 'secondary' : 'ghost'}
          >
            <span className="truncate">{text}</span>
            <ChevronDown className="ml-auto transition-transform duration-200" />
          </Button>
        </AccordionTrigger>

        <AccordionContent className="py-2">
          {children.map(child => {
            const activeChild = pathname.startsWith(child.href);

            return (
              <DrawerClose asChild key={child.id}>
                <Button
                  asChild
                  className="flex h-auto w-full max-w-full flex-col items-start gap-1 px-4 py-2 text-left"
                  variant={activeChild ? 'secondary' : 'ghost'}
                >
                  <Link
                    href={child.href}
                    rel={child.external ? 'noopener noreferrer' : undefined}
                    target={child.external ? '_blank' : undefined}
                  >
                    <span className="truncate">{convertText(child.name)}</span>
                    {child.description.length > 0 && (
                      <p className="text-muted-foreground line-clamp-2 truncate whitespace-normal text-sm leading-snug">
                        {convertText(child.description)}
                      </p>
                    )}
                  </Link>
                </Button>
              </DrawerClose>
            );
          })}
        </AccordionContent>
      </AccordionItem>
    );
  }

  return (
    <DrawerClose asChild>
      <Button
        asChild
        className={cn('max-w-full justify-start text-left font-normal', {
          'text-muted-foreground': !active,
        })}
        variant={active ? 'secondary' : 'ghost'}
      >
        <Link
          href={href}
          rel={external ? 'noopener noreferrer' : undefined}
          target={external ? '_blank' : undefined}
        >
          <span className="truncate">{text}</span>
        </Link>
      </Button>
    </DrawerClose>
  );
};
