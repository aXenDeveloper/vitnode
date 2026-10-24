import { cn } from "cn";
import { useTranslations } from "use-intl";

import { Card, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const AUTH_CARD_VIEW_TRANSITION_NAME = "vitnode-auth-card";

const MethodsSeparator = ({ label }: { label: React.ReactNode }) => (
  <div className="flex items-center gap-4 md:flex-col" role="presentation">
    <span className="flex-1 border-t md:border-t-0 md:border-l" />
    <span className="text-muted-foreground text-xs">{label}</span>
    <span className="flex-1 border-t md:border-t-0 md:border-l" />
  </div>
);

export const AuthFrame = ({
  children,
  isWide = false,
}: {
  children: React.ReactNode;
  isWide?: boolean;
}) => (
  <div
    className={cn(
      "mx-auto flex w-full flex-col justify-center px-4 py-16 md:min-h-[calc(100vh-4rem)]",
      isWide ? "max-w-3xl" : "max-w-md",
    )}
  >
    {children}
  </div>
);

const AuthCardFrame = ({
  alternatives,
  footer,
  form,
  heading,
  notice,
  separatorLabel,
}: {
  alternatives?: React.ReactNode;
  footer?: React.ReactNode;
  form?: React.ReactNode;
  heading: React.ReactNode;
  notice?: React.ReactNode;
  separatorLabel: React.ReactNode;
}) => {
  const isSplit = !!alternatives && !!form;

  return (
    <AuthFrame isWide={isSplit}>
      <Card
        className="bg-muted gap-0 p-0"
        style={{ viewTransitionName: AUTH_CARD_VIEW_TRANSITION_NAME }}
      >
        <div className="bg-card flex flex-col gap-8 rounded-xl p-6">
          {heading}

          {notice}

          {isSplit ? (
            <div className="flex flex-col gap-6 md:flex-row md:gap-8">
              <div className="flex flex-col gap-3 md:flex-1">
                {alternatives}
              </div>
              <MethodsSeparator label={separatorLabel} />
              <div className="md:flex-1">{form}</div>
            </div>
          ) : (
            <>
              {alternatives ? (
                <div className="flex flex-col gap-3">{alternatives}</div>
              ) : null}
              {form}
            </>
          )}
        </div>

        {footer ? (
          <div className="text-accent-foreground p-6 text-center text-sm">
            {footer}
          </div>
        ) : null}
      </Card>
    </AuthFrame>
  );
};

export const AuthCard = ({
  description,
  title,
  ...props
}: {
  alternatives?: React.ReactNode;
  description: React.ReactNode;
  footer?: React.ReactNode;
  form?: React.ReactNode;
  notice?: React.ReactNode;
  title: React.ReactNode;
}) => {
  const t = useTranslations("core.global");

  return (
    <AuthCardFrame
      heading={
        <div className="flex flex-col gap-2 text-center">
          <h1 className="text-2xl leading-none font-semibold tracking-tight text-balance">
            {title}
          </h1>
          <CardDescription className="text-pretty">
            {description}
          </CardDescription>
        </div>
      }
      separatorLabel={t("or")}
      {...props}
    />
  );
};

export const TextLineSkeleton = ({
  className,
  wrapperClassName,
}: {
  className?: string;
  wrapperClassName?: string;
}) => (
  <div className={cn("flex h-5 items-center", wrapperClassName)}>
    <Skeleton className={cn("h-3.5", className)} />
  </div>
);

export const AuthFieldSkeleton = ({
  labelClassName = "w-20",
  withLabelRight = false,
}: {
  labelClassName?: string;
  withLabelRight?: boolean;
}) => (
  <div className="flex flex-col gap-3">
    <div className="flex h-5 items-center justify-between gap-4">
      <Skeleton className={cn("h-3.5", labelClassName)} />
      {withLabelRight ? <Skeleton className="h-3.5 w-28" /> : null}
    </div>
    <Skeleton className="h-9 w-full" />
  </div>
);

export const AuthCardSkeleton = ({
  alternatives,
  form,
  label = "Loading",
}: {
  alternatives?: React.ReactNode;
  form?: React.ReactNode;
  label?: string;
}) => (
  <div aria-busy="true" className="contents" data-slot="route-pending">
    <span className="sr-only" role="status">
      {label}
    </span>

    <AuthCardFrame
      alternatives={alternatives}
      footer={
        <TextLineSkeleton
          className="bg-foreground/10 w-56 max-w-full"
          wrapperClassName="justify-center"
        />
      }
      form={form}
      heading={
        <div className="flex flex-col items-center gap-2">
          <Skeleton className="h-6 w-28" />
          <TextLineSkeleton
            className="w-64 max-w-full"
            wrapperClassName="w-full justify-center"
          />
        </div>
      }
      separatorLabel={<Skeleton className="block h-3 w-4" />}
    />
  </div>
);
