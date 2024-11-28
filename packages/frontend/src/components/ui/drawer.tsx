'use client';

import React from 'react';
import { Drawer as DrawerPrimitive } from 'vaul';

import { cn } from '../../helpers/classnames';

const Drawer = ({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) => (
  <DrawerPrimitive.Root {...props} />
);

const DrawerTrigger = DrawerPrimitive.Trigger;

const DrawerPortal = DrawerPrimitive.Portal;

const DrawerClose = DrawerPrimitive.Close;

const DrawerOverlay = ({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Overlay>) => (
  <DrawerPrimitive.Overlay
    className={cn('fixed inset-0 z-40 bg-black/60', className)}
    {...props}
  />
);

const DrawerContent = ({
  className,
  children,
  direction = 'bottom',
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Content> & {
  direction?: React.ComponentProps<typeof DrawerPrimitive.Root>['direction'];
}) => (
  <DrawerPortal>
    <DrawerOverlay />
    <DrawerPrimitive.Content
      className={cn(
        'bg-card fixed z-50 flex flex-col outline-none',
        {
          'left-0 right-0 top-0 mb-24 max-h-[80%] rounded-b-[10px]':
            direction === 'top',
          'bottom-0 left-0 mr-24 h-full max-w-[80%] rounded-r-[10px]':
            direction === 'left',
          'bottom-0 right-0 top-0 ml-24 max-w-[80%] rounded-l-[10px]':
            direction === 'right',
          'bottom-0 left-0 right-0 mt-24 max-h-[80%] rounded-t-[10px]':
            direction === 'bottom',
        },
        className,
      )}
      {...props}
    >
      <div className="flex-1 overflow-y-auto rounded-t-[10px]">{children}</div>
    </DrawerPrimitive.Content>
  </DrawerPortal>
);

const DrawerHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('grid gap-1.5 p-4 text-center sm:text-left', className)}
    {...props}
  />
);

const DrawerFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('mt-auto flex flex-col gap-2 p-4', className)}
    {...props}
  />
);

const DrawerTitle = ({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Title>) => (
  <DrawerPrimitive.Title
    className={cn(
      'text-lg font-semibold leading-none tracking-tight',
      className,
    )}
    {...props}
  />
);

const DrawerDescription = ({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Description>) => (
  <DrawerPrimitive.Description
    className={cn('text-muted-foreground text-sm', className)}
    {...props}
  />
);

export {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerPortal,
  DrawerTitle,
  DrawerTrigger,
};
