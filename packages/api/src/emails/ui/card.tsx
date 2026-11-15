import { cn } from "cn";
import { Section, Text } from "react-email";

/**
 * A bordered, rounded card for an email's message, with header, title,
 * description, content and footer parts. Colors come from
 * `DefaultTemplateEmail`, so use it inside that template.
 */
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

/** The card's top section, for the title and description. */
export const EmailCardHeader = ({
  className,
  ...props
}: React.ComponentProps<typeof Section>) => {
  return <Section className={cn("mb-6 px-6", className)} {...props} />;
};

/** The card's heading text. */
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

/** Muted, smaller text under the title. */
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

/** The card's main section. */
export const EmailCardContent = ({
  className,
  ...props
}: React.ComponentProps<typeof Section>) => {
  return <Section className={cn("px-6", className)} {...props} />;
};

/** The card's bottom section, e.g. for a button. */
export const EmailCardFooter = ({
  className,
  ...props
}: React.ComponentProps<typeof Section>) => {
  return <Section className={cn("mt-6 px-6", className)} {...props} />;
};
