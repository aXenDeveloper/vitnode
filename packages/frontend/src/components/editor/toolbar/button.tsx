import { useTranslations } from 'next-intl';
import React from 'react';

import { cn } from '../../../helpers/classnames';
import { Button } from '../../ui/button';

export const ButtonToolbarEditor = ({
  active,
  children,
  disabled,
  name,
  onClick,
  className,
  ...rest
}: {
  active?: boolean;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  name: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}) => {
  const t = useTranslations('core.global.editor');

  return (
    <Button
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      ariaLabel={t(name)}
      className={cn('hover:bg-muted size-9 shadow-none', className, {
        'bg-accent': active,
      })}
      disabled={disabled}
      onClick={onClick}
      size="icon"
      variant="ghost"
      {...rest}
    >
      {children}
    </Button>
  );
};
