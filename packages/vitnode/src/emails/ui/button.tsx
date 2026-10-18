import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Button as ButtonReactEmail } from "react-email";

const buttonVariants = cva(
  "cursor-pointer whitespace-nowrap rounded-md text-sm font-medium outline-none",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-xs",
        destructive: "bg-destructive text-white shadow-xs",
        destructiveGhost: "text-destructive",
        outline: "border bg-background shadow-xs",
        secondary: "bg-secondary text-secondary-foreground shadow-xs",
        ghost: "",
        link: "text-primary underline-offset-4",
      },
      size: {
        default: "px-4 py-2",
        sm: "rounded-md gap-1.5 px-3 py-1.5",
        lg: "rounded-md px-6 py-2.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

/**
 * A link styled as a button for emails, built on react-email's `Button`. Pass
 * `href` and children; `variant` (`default`, `destructive`, `destructiveGhost`,
 * `outline`, `secondary`, `ghost`, `link`; default `default`) and `size`
 * (`default`, `sm`, `lg`; default `default`) pick the style. Its colors come from `DefaultTemplateEmail`, so use it
 * inside that template.
 */
export const EmailButton = ({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof ButtonReactEmail> &
  VariantProps<typeof buttonVariants>) => {
  return (
    <ButtonReactEmail
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
};
