import { Section, Text } from "@react-email/components";

import { cn } from "@/lib/utils";

export const EmailCard = ({
  className,
  ...props
}: React.ComponentProps<typeof Section>) => {
  return (
    <Section
      className={cn(
        "bg-card text-card-foreground border-border rounded-xl border border-solid py-6 shadow-sm",
        className,
      )}
      {...props}
    />
  );
};

export const EmailCardHeader = ({
  className,
  ...props
}: React.ComponentProps<typeof Section>) => {
  return <Section className={cn("mb-6 px-6", className)} {...props} />;
};

export const EmailCardTitle = ({
  className,
  ...props
}: React.ComponentProps<typeof Text>) => {
  return (
    <Text
      className={cn("text-xl leading-[0] font-semibold", className)}
      {...props}
    />
  );
};

export const EmailCardDescription = ({
  className,
  ...props
}: React.ComponentProps<typeof Text>) => {
  return (
    <Text
      className={cn("text-muted-foreground m-0 text-sm", className)}
      {...props}
    />
  );
};

export const EmailCardContent = ({
  className,
  ...props
}: React.ComponentProps<typeof Section>) => {
  return <Section className={cn("px-6", className)} {...props} />;
};

export const EmailCardFooter = ({
  className,
  ...props
}: React.ComponentProps<typeof Section>) => {
  return <Section className={cn("mt-6 px-6", className)} {...props} />;
};
