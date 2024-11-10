import { cn } from '@/helpers/classnames';
import { Slot } from '@radix-ui/react-slot';
import { cva, VariantProps } from 'class-variance-authority';

import { Input } from './input';
import { ScrollArea } from './scroll-area';
import { Separator } from './separator';
import { TooltipContentSidebarMenuButton } from './sidebar';
import { Skeleton } from './skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

const SidebarInset = ({
  className,
  ...props
}: React.ComponentProps<'main'>) => (
  <main
    className={cn(
      'bg-background relative flex min-h-svh flex-1 flex-col',
      'overflow-auto peer-data-[variant=inset]:min-h-[calc(100svh-theme(spacing.4))] md:peer-data-[variant=inset]:m-2 md:peer-data-[state=collapsed]:peer-data-[variant=inset]:ml-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow',
      className,
    )}
    {...props}
  />
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
        'data-[active=true]:bg-primary/10 data-[active=true]:text-primary text-muted-foreground transition-colors',
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

const SidebarMenuSkeleton = ({
  className,
  showIcon = false,
  ...props
}: {
  showIcon?: boolean;
} & React.ComponentProps<'div'>) => {
  const width = `${Math.floor(Math.random() * 40) + 50}%`;

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

const sidebarMenuButtonVariants = cva(
  'peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none ring-ring transition-[width,height,padding] hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 active:bg-accent active:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-[[data-sidebar=menu-action]]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-primary/10 data-[active=true]:font-medium data-[active=true]:text-primary data-[state=open]:hover:bg-accent data-[state=open]:hover:text-accent-foreground group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!p-2 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 text-muted-foreground transition-colors',
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
      <TooltipContentSidebarMenuButton {...tooltip} />
    </Tooltip>
  );
};

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
      className={cn('flex flex-col gap-2 px-3 py-2', className)}
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
      className={cn('flex flex-col gap-2 px-2 py-3', className)}
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
}: React.ComponentProps<typeof ScrollArea>) => {
  return (
    <ScrollArea
      className={cn('flex-1', className)}
      data-sidebar="content"
      {...props}
    />
  );
};

const SidebarGroup = ({ className, ...props }: React.ComponentProps<'div'>) => {
  return (
    <div
      className={cn(
        'relative flex w-full min-w-0 flex-col px-3 py-2',
        className,
      )}
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

export {
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
  SidebarSeparator,
};
