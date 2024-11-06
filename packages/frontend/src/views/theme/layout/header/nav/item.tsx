'use client';

import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/helpers/classnames';
import { useTextLang } from '@/hooks/use-text-lang';
import { Link, usePathname } from '@/navigation';
import { PopoverClose } from '@radix-ui/react-popover';
import { ChevronDown } from 'lucide-react';
import { ShowNavStyles } from 'vitnode-shared/nav.dto';

export const ItemNavHeader = ({
  children,
  external,
  href,
  name,
}: ShowNavStyles) => {
  const { convertText } = useTextLang();
  const pathname = usePathname();
  const active = pathname.startsWith(href);
  const text = convertText(name);

  if (children.length > 0) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            className={cn('px-6', {
              'text-muted-foreground': !active,
            })}
            size="sm"
            variant={active ? 'secondary' : 'ghost'}
          >
            {text} <ChevronDown />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="max-w-96 p-2">
          {children.map(child => {
            const activeChild = pathname.startsWith(child.href);

            return (
              <PopoverClose asChild key={child.id}>
                <Button
                  asChild
                  className="flex h-auto w-full flex-col items-start gap-1 px-4 py-2 text-left"
                  size="sm"
                  variant={activeChild ? 'secondary' : 'ghost'}
                >
                  <Link
                    href={child.href}
                    rel={child.external ? 'noopener noreferrer' : undefined}
                    target={child.external ? '_blank' : undefined}
                  >
                    <span>{convertText(child.name)}</span>
                    {child.description.length > 0 && (
                      <p className="text-muted-foreground line-clamp-2 truncate whitespace-normal text-sm leading-snug">
                        {convertText(child.description)}
                      </p>
                    )}
                  </Link>
                </Button>
              </PopoverClose>
            );
          })}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Button
      asChild
      className={cn('px-6', {
        'text-muted-foreground': !active,
      })}
      size="sm"
      variant={active ? 'secondary' : 'ghost'}
    >
      <Link
        href={href}
        rel={external ? 'noopener noreferrer' : undefined}
        target={external ? '_blank' : undefined}
      >
        {text}
      </Link>
    </Button>
  );
};
