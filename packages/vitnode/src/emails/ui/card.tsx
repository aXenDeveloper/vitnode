import { Section, Text } from '@react-email/components';

import { cn } from '@/lib/utils';

export const Card = ({
  className,
  ...props
}: React.ComponentProps<typeof Section>) => {
  return (
    <Section
      className={cn(
        'bg-card text-card-foreground border-border rounded-xl border border-solid py-6 shadow-sm',
        className,
      )}
      {...props}
    />
  );
};

export const CardHeader = ({
  className,
  ...props
}: React.ComponentProps<typeof Section>) => {
  return <Section className={cn('mb-6 px-6', className)} {...props} />;
};

export const CardTitle = ({
  className,
  ...props
}: React.ComponentProps<typeof Text>) => {
  return (
    <Text className={cn('font-semibold leading-[0]', className)} {...props} />
  );
};

export const CardDescription = ({
  className,
  ...props
}: React.ComponentProps<typeof Text>) => {
  return (
    <Text
      className={cn('text-muted-foreground m-0 text-sm', className)}
      {...props}
    />
  );
};

export const CardContent = ({
  className,
  ...props
}: React.ComponentProps<typeof Section>) => {
  return <Section className={cn('px-6', className)} {...props} />;
};

export const CardFooter = ({
  className,
  ...props
}: React.ComponentProps<typeof Section>) => {
  return <Section className={cn('mt-6 px-6', className)} {...props} />;
};
