'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/helpers/classnames';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { Slot } from '@radix-ui/react-slot';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { cva, VariantProps } from 'class-variance-authority';
import { PanelLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React from 'react';

const SIDEBAR_COOKIE_NAME = 'sidebar:state';
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const SIDEBAR_WIDTH = '16rem';
const SIDEBAR_WIDTH_MOBILE = '18rem';
const SIDEBAR_WIDTH_ICON = '3rem';
const SIDEBAR_KEYBOARD_SHORTCUT = 'b';

interface SidebarContext {
  isMobile: boolean;
  open: boolean;
  openMobile: boolean;
  setOpen: (open: boolean) => void;
  setOpenMobile: (open: boolean) => void;
  state: 'collapsed' | 'expanded';
  toggleSidebar: () => void;
}

const SidebarContext = React.createContext<null | SidebarContext>(null);

function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider.');
  }

  return context;
}

const SidebarProvider = ({
  defaultOpen = true,
  open: openProp,
  onOpenChange: setOpenProp,
  className,
  style,
  children,
  ...props
}: {
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
} & React.ComponentProps<'div'>) => {
  const isMobile = useIsMobile();
  const [openMobile, setOpenMobile] = React.useState(false);

  // This is the internal state of the sidebar.
  // We use openProp and setOpenProp for control from outside the component.
  const [_open, _setOpen] = React.useState(defaultOpen);
  const open = openProp ?? _open;
  const setOpen = React.useCallback(
    (value: ((value: boolean) => boolean) | boolean) => {
      if (setOpenProp) {
        setOpenProp?.(typeof value === 'function' ? value(open) : value);

        return;
      }

      _setOpen(value);

      // This sets the cookie to keep the sidebar state.
      // eslint-disable-next-line react-compiler/react-compiler
      document.cookie = `${SIDEBAR_COOKIE_NAME}=${open}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
    },
    [setOpenProp, open],
  );

  // Helper to toggle the sidebar.
  const toggleSidebar = React.useCallback(() => {
    if (isMobile) {
      setOpenMobile(open => !open);

      return;
    }

    setOpen(open => !open);
  }, [isMobile, setOpen, setOpenMobile]);

  // Adds a keyboard shortcut to toggle the sidebar.
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        toggleSidebar();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [toggleSidebar]);

  // We add a state so that we can do data-state="expanded" or "collapsed".
  // This makes it easier to style the sidebar with Tailwind classes.
  const state = open ? 'expanded' : 'collapsed';

  const contextValue = React.useMemo<SidebarContext>(
    () => ({
      state,
      open,
      setOpen,
      isMobile,
      openMobile,
      setOpenMobile,
      toggleSidebar,
    }),
    [state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar],
  );

  return (
    <SidebarContext.Provider value={contextValue}>
      <TooltipProvider delayDuration={0}>
        <div
          className={cn(
            'group/sidebar-wrapper has-[[data-variant=inset]]:bg-card flex min-h-svh w-full',
            className,
          )}
          style={
            {
              '--sidebar-width': SIDEBAR_WIDTH,
              '--sidebar-width-icon': SIDEBAR_WIDTH_ICON,
              ...style,
            } as React.CSSProperties
          }
          {...props}
        >
          {children}
        </div>
      </TooltipProvider>
    </SidebarContext.Provider>
  );
};

const Sidebar = ({
  side = 'left',
  variant = 'sidebar',
  collapsible = 'offcanvas',
  className,
  children,
  ...props
}: {
  collapsible?: 'icon' | 'none' | 'offcanvas';
  side?: 'left' | 'right';
  variant?: 'floating' | 'inset' | 'sidebar';
} & React.ComponentProps<'div'>) => {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar();
  const t = useTranslations('core.global');

  if (collapsible === 'none') {
    return (
      <div
        className={cn(
          'bg-card text-foreground flex h-full w-[--sidebar-width] flex-col',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  }

  if (isMobile) {
    return (
      <Sheet onOpenChange={setOpenMobile} open={openMobile} {...props}>
        <VisuallyHidden>
          <SheetHeader>
            <SheetTitle>{t('sidebar.title')}</SheetTitle>
            <SheetDescription>{t('sidebar.desc')}</SheetDescription>
          </SheetHeader>
        </VisuallyHidden>
        <SheetContent
          className="bg-card text-foreground w-[--sidebar-width] p-0 [&>button]:hidden"
          data-mobile="true"
          data-sidebar="sidebar"
          side={side}
          style={
            {
              '--sidebar-width': SIDEBAR_WIDTH_MOBILE,
            } as React.CSSProperties
          }
        >
          <div className="flex h-full w-full flex-col">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div
      className="text-foreground group peer hidden md:block"
      data-collapsible={state === 'collapsed' ? collapsible : ''}
      data-side={side}
      data-state={state}
      data-variant={variant}
      {...props}
    >
      {/* This is what handles the sidebar gap on desktop */}
      <div
        className={cn(
          'relative h-svh w-[--sidebar-width] bg-transparent transition-[width] duration-200 ease-in-out',
          'group-data-[collapsible=offcanvas]:w-0',
          'group-data-[side=right]:rotate-180',
          variant === 'floating' || variant === 'inset'
            ? 'group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)_+_theme(spacing.4))]'
            : 'group-data-[collapsible=icon]:w-[--sidebar-width-icon]',
        )}
      />
      <div
        className={cn(
          'fixed inset-y-0 z-10 hidden h-svh w-[--sidebar-width] transition-[left,right,width] duration-200 ease-in-out md:flex',
          side === 'left'
            ? 'left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]'
            : 'right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]',
          // Adjust the padding for floating and inset variants.
          variant === 'floating' || variant === 'inset'
            ? 'p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)_+_theme(spacing.4)_+2px)]'
            : 'group-data-[collapsible=icon]:w-[--sidebar-width-icon] group-data-[side=left]:border-r group-data-[side=right]:border-l',
          className,
        )}
        {...props}
      >
        <div
          className="bg-card group-data-[variant=floating]:border-border flex h-full w-full flex-col group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:shadow"
          data-sidebar="sidebar"
        >
          {children}
        </div>
      </div>
    </div>
  );
};

const SidebarTrigger = ({
  className,
  onClick,
  ...props
}: React.ComponentProps<typeof Button>) => {
  const { toggleSidebar } = useSidebar();
  const t = useTranslations('core.global');

  return (
    <Button
      ariaLabel={t('sidebar.toggle')}
      className={cn('size-7', className)}
      data-sidebar="trigger"
      onClick={event => {
        onClick?.(event);
        toggleSidebar();
      }}
      size="icon"
      variant="ghost"
      {...props}
    >
      <PanelLeft />
    </Button>
  );
};

const SidebarRail = ({
  className,
  ...props
}: React.ComponentProps<'button'>) => {
  const { toggleSidebar } = useSidebar();

  return (
    <button
      aria-label="Toggle Sidebar"
      className={cn(
        'hover:after:bg-border absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-in-out after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] group-data-[side=left]:-right-4 group-data-[side=right]:left-0 sm:flex',
        '[[data-side=left]_&]:cursor-w-resize [[data-side=right]_&]:cursor-e-resize',
        '[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize',
        'group-data-[collapsible=offcanvas]:hover:bg-card group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full',
        '[[data-side=left][data-collapsible=offcanvas]_&]:-right-2',
        '[[data-side=right][data-collapsible=offcanvas]_&]:-left-2',
        className,
      )}
      data-sidebar="rail"
      onClick={toggleSidebar}
      tabIndex={-1}
      title="Toggle Sidebar"
      {...props}
    />
  );
};

const SidebarInset = ({
  className,
  ...props
}: React.ComponentProps<'main'>) => (
  <main
    className={cn(
      'bg-background relative flex min-h-svh flex-1 flex-col',
      'peer-data-[variant=inset]:min-h-[calc(100svh-theme(spacing.4))] md:peer-data-[variant=inset]:m-2 md:peer-data-[state=collapsed]:peer-data-[variant=inset]:ml-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow',
      className,
    )}
    {...props}
  />
);

const SidebarInput = ({
  className,
  ...props
}: React.ComponentProps<typeof Input>) => (
  <Input
    className={cn(
      'bg-background focus-visible:ring-ring h-8 w-full shadow-none focus-visible:ring-2',
      className,
    )}
    data-sidebar="input"
    {...props}
  />
);

const SidebarHeader = ({
  className,
  ...props
}: React.ComponentProps<'div'>) => {
  return (
    <div
      className={cn('flex flex-col gap-2 p-2', className)}
      data-sidebar="header"
      {...props}
    />
  );
};

const SidebarFooter = ({
  className,
  ...props
}: React.ComponentProps<'div'>) => {
  return (
    <div
      className={cn('flex flex-col gap-2 p-2', className)}
      data-sidebar="footer"
      {...props}
    />
  );
};

const SidebarSeparator = ({
  className,
  ...props
}: React.ComponentProps<typeof Separator>) => {
  return (
    <Separator
      className={cn('bg-border mx-2 w-auto', className)}
      data-sidebar="separator"
      {...props}
    />
  );
};

const SidebarContent = ({
  className,
  ...props
}: React.ComponentProps<'div'>) => {
  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden',
        className,
      )}
      data-sidebar="content"
      {...props}
    />
  );
};

const SidebarGroup = ({ className, ...props }: React.ComponentProps<'div'>) => {
  return (
    <div
      className={cn('relative flex w-full min-w-0 flex-col p-2', className)}
      data-sidebar="group"
      {...props}
    />
  );
};

const SidebarGroupLabel = ({
  className,
  asChild = false,
  ...props
}: { asChild?: boolean } & React.ComponentProps<'div'>) => {
  const Comp = asChild ? Slot : 'div';

  return (
    <Comp
      className={cn(
        'text-foreground/70 ring-ring flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium outline-none transition-[margin,opa] duration-200 ease-in-out focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0',
        'group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0',
        className,
      )}
      data-sidebar="group-label"
      {...props}
    />
  );
};

const SidebarGroupAction = ({
  className,
  asChild = false,
  ...props
}: { asChild?: boolean } & React.ComponentProps<'button'>) => {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      className={cn(
        'text-foreground ring-ring hover:bg-accent hover:text-accent-foreground absolute right-3 top-3.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 outline-none transition-transform focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0',
        // Increases the hit area of the button on mobile.
        'after:absolute after:-inset-2 after:md:hidden',
        'group-data-[collapsible=icon]:hidden',
        className,
      )}
      data-sidebar="group-action"
      {...props}
    />
  );
};

const SidebarGroupContent = ({
  className,
  ...props
}: React.ComponentProps<'div'>) => (
  <div
    className={cn('w-full text-sm', className)}
    data-sidebar="group-content"
    {...props}
  />
);

const SidebarMenu = ({ className, ...props }: React.ComponentProps<'ul'>) => (
  <ul
    className={cn('flex w-full min-w-0 flex-col gap-1', className)}
    data-sidebar="menu"
    {...props}
  />
);

const SidebarMenuItem = ({
  className,
  ...props
}: React.ComponentProps<'li'>) => (
  <li
    className={cn('group/menu-item relative', className)}
    data-sidebar="menu-item"
    {...props}
  />
);

const sidebarMenuButtonVariants = cva(
  'peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none ring-ring transition-[width,height,padding] hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 active:bg-accent active:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-[[data-sidebar=menu-action]]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-accent data-[active=true]:font-medium data-[active=true]:text-accent-foreground data-[state=open]:hover:bg-accent data-[state=open]:hover:text-accent-foreground group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!p-2 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'hover:bg-accent hover:text-accent-foreground',
        outline:
          'bg-background shadow-[0_0_0_1px_hsl(var(--border))] hover:bg-accent hover:text-accent-foreground hover:shadow-[0_0_0_1px_hsl(var(--accent))]',
      },
      size: {
        default: 'h-8 text-sm',
        sm: 'h-7 text-xs',
        lg: 'h-12 text-sm group-data-[collapsible=icon]:!p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

const SidebarMenuButton = ({
  asChild = false,
  isActive = false,
  variant = 'default',
  size = 'default',
  tooltip,
  className,
  ...props
}: {
  asChild?: boolean;
  isActive?: boolean;
  tooltip?: React.ComponentProps<typeof TooltipContent> | string;
} & React.ComponentProps<'button'> &
  VariantProps<typeof sidebarMenuButtonVariants>) => {
  const Comp = asChild ? Slot : 'button';
  const { isMobile, state } = useSidebar();

  const button = (
    <Comp
      className={cn(sidebarMenuButtonVariants({ variant, size }), className)}
      data-active={isActive}
      data-sidebar="menu-button"
      data-size={size}
      {...props}
    />
  );

  if (!tooltip) {
    return button;
  }

  if (typeof tooltip === 'string') {
    tooltip = {
      children: tooltip,
    };
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent
        align="center"
        hidden={state !== 'collapsed' || isMobile}
        side="right"
        {...tooltip}
      />
    </Tooltip>
  );
};

const SidebarMenuAction = ({
  className,
  asChild = false,
  showOnHover = false,
  ...props
}: {
  asChild?: boolean;
  showOnHover?: boolean;
} & React.ComponentProps<'button'>) => {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      className={cn(
        'text-foreground ring-ring hover:bg-accent hover:text-accent-foreground peer-hover/menu-button:text-accent-foreground absolute right-1 top-1.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 outline-none transition-transform focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0',
        // Increases the hit area of the button on mobile.
        'after:absolute after:-inset-2 after:md:hidden',
        'peer-data-[size=sm]/menu-button:top-1',
        'peer-data-[size=default]/menu-button:top-1.5',
        'peer-data-[size=lg]/menu-button:top-2.5',
        'group-data-[collapsible=icon]:hidden',
        showOnHover &&
          'peer-data-[active=true]/menu-button:text-accent-foreground group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 md:opacity-0',
        className,
      )}
      data-sidebar="menu-action"
      {...props}
    />
  );
};

const SidebarMenuBadge = ({
  className,
  ...props
}: React.ComponentProps<'div'>) => (
  <div
    className={cn(
      'text-foreground pointer-events-none absolute right-1 flex h-5 min-w-5 select-none items-center justify-center rounded-md px-1 text-xs font-medium tabular-nums',
      'peer-hover/menu-button:text-accent-foreground peer-data-[active=true]/menu-button:text-accent-foreground',
      'peer-data-[size=sm]/menu-button:top-1',
      'peer-data-[size=default]/menu-button:top-1.5',
      'peer-data-[size=lg]/menu-button:top-2.5',
      'group-data-[collapsible=icon]:hidden',
      className,
    )}
    data-sidebar="menu-badge"
    {...props}
  />
);

const SidebarMenuSkeleton = ({
  className,
  showIcon = false,
  ...props
}: {
  showIcon?: boolean;
} & React.ComponentProps<'div'>) => {
  // Random width between 50 to 90%.
  const width = React.useMemo(() => {
    return `${Math.floor(Math.random() * 40) + 50}%`;
  }, []);

  return (
    <div
      className={cn('flex h-8 items-center gap-2 rounded-md px-2', className)}
      data-sidebar="menu-skeleton"
      {...props}
    >
      {showIcon && (
        <Skeleton
          className="size-4 rounded-md"
          data-sidebar="menu-skeleton-icon"
        />
      )}
      <Skeleton
        className="h-4 max-w-[--skeleton-width] flex-1"
        data-sidebar="menu-skeleton-text"
        style={
          {
            '--skeleton-width': width,
          } as React.CSSProperties
        }
      />
    </div>
  );
};

const SidebarMenuSub = ({
  className,
  ...props
}: React.ComponentProps<'ul'>) => (
  <ul
    className={cn(
      'border-border mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l px-2.5 py-0.5',
      'group-data-[collapsible=icon]:hidden',
      className,
    )}
    data-sidebar="menu-sub"
    {...props}
  />
);

const SidebarMenuSubItem = (props: React.ComponentProps<'li'>) => (
  <li {...props} />
);

const SidebarMenuSubButton = ({
  asChild = false,
  size = 'md',
  isActive,
  className,
  ...props
}: {
  asChild?: boolean;
  isActive?: boolean;
  size?: 'md' | 'sm';
} & React.ComponentProps<'a'>) => {
  const Comp = asChild ? Slot : 'a';

  return (
    <Comp
      className={cn(
        'text-foreground ring-ring hover:bg-accent hover:text-accent-foreground active:bg-accent active:text-accent-foreground [&>svg]:text-accent-foreground flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0',
        'data-[active=true]:bg-accent data-[active=true]:text-accent-foreground',
        size === 'sm' && 'text-xs',
        size === 'md' && 'text-sm',
        'group-data-[collapsible=icon]:hidden',
        className,
      )}
      data-active={isActive}
      data-sidebar="menu-sub-button"
      data-size={size}
      {...props}
    />
  );
};

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
};
