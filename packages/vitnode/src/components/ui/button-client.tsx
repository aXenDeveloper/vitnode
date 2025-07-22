'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { Slot } from 'radix-ui';

import { cn } from '../../lib/utils';
import { type ButtonProps, buttonVariants } from './button';
import { Loader } from './loader';

export function ClientButton({
  className,
  variant,
  size,
  asChild = false,
  isLoading,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button';
  const t = useTranslations('core.global');

  return (
    <Comp
      aria-label={isLoading ? t('loading') : props['aria-label']}
      className={cn(buttonVariants({ variant, size, className }))}
      data-slot="button"
      disabled={isLoading ?? props.disabled}
      {...props}
    >
      <div className="relative flex items-center justify-center">
        <div
          className={cn(
            'flex items-center justify-center gap-2 transition-opacity duration-300',
            isLoading ? 'opacity-0' : 'opacity-100',
          )}
        >
          {children}
        </div>

        <AnimatePresence>
          {isLoading && (
            <motion.div
              animate={{ opacity: 1, transform: 'translateY(0px)' }}
              className="absolute inset-0 flex items-center justify-center"
              exit={{ opacity: 0, transform: 'translateY(20px)' }}
              initial={{ opacity: 0, transform: 'translateY(-20px)' }}
              transition={{ type: 'spring', duration: 0.4, bounce: 0 }}
            >
              <Loader small />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Comp>
  );
}
