import { cn } from "cn";
import { useTranslations } from "use-intl";

import { Card, CardDescription } from "@/components/ui/card";

export const AUTH_CARD_VIEW_TRANSITION_NAME = "vitnode-auth-card";

const MethodsSeparator = () => {
  const t = useTranslations("core.global");

  return (
    <div className="flex items-center gap-4 md:flex-col" role="presentation">
      <span className="flex-1 border-t md:border-t-0 md:border-l" />
      <span className="text-muted-foreground text-xs">{t("or")}</span>
      <span className="flex-1 border-t md:border-t-0 md:border-l" />
    </div>
  );
};

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

export const AuthCard = ({
  alternatives,
  description,
  footer,
  form,
  notice,
  title,
}: {
  alternatives?: React.ReactNode;
  description: React.ReactNode;
  footer?: React.ReactNode;
  form?: React.ReactNode;
  notice?: React.ReactNode;
  title: React.ReactNode;
}) => {
  const isSplit = !!alternatives && !!form;

  return (
    <AuthFrame isWide={isSplit}>
      <Card
        className="bg-muted gap-0 p-0"
        style={{ viewTransitionName: AUTH_CARD_VIEW_TRANSITION_NAME }}
      >
        <div className="bg-card flex flex-col gap-8 rounded-xl p-6">
          <div className="flex flex-col gap-2 text-center">
            <h1 className="text-2xl leading-none font-semibold tracking-tight text-balance">
              {title}
            </h1>
            <CardDescription className="text-pretty">
              {description}
            </CardDescription>
          </div>

          {notice}

          {isSplit ? (
            <div className="flex flex-col gap-6 md:flex-row md:gap-8">
              <div className="flex flex-col gap-3 md:flex-1">
                {alternatives}
              </div>
              <MethodsSeparator />
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
