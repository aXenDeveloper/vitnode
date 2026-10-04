import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Loader2Icon } from "lucide-react";
import { useTranslations } from "use-intl";

const spinnerVariants = cva("shrink-0 animate-spin", {
  variants: {
    size: {
      sm: "size-3",
      default: "size-4",
      lg: "size-6",
      xl: "size-10",
    },
  },
  defaultVariants: {
    size: "default",
  },
});

type SpinnerProps = React.ComponentProps<"svg"> &
  VariantProps<typeof spinnerVariants>;

const SpinnerIcon = ({ className, size, ...props }: SpinnerProps) => (
  <Loader2Icon
    className={cn(spinnerVariants({ size }), className)}
    data-size={size ?? "default"}
    data-slot="spinner"
    role="status"
    {...props}
  />
);

const TranslatedSpinner = (props: SpinnerProps) => {
  const t = useTranslations("core.global");

  return <SpinnerIcon aria-label={t("loading")} {...props} />;
};

function Spinner(props: SpinnerProps) {
  const isLabelled =
    props["aria-label"] !== undefined ||
    props["aria-hidden"] === true ||
    props["aria-hidden"] === "true";

  return isLabelled ? (
    <SpinnerIcon {...props} />
  ) : (
    <TranslatedSpinner {...props} />
  );
}

export { Spinner };
