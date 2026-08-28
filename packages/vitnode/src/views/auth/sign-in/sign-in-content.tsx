"use client";

import { useTranslations } from "use-intl";

import { Card, CardDescription } from "@/components/ui/card";

import type { AuthLinkComponent } from "../auth-link";

import { AUTH_HREF } from "../auth-link";

/**
 * The login card - the heading, the copy, and the two slots that fill it.
 *
 * Presentation only, and framework-free on purpose: it reaches nothing from
 * `next/*`, from `next-intl`'s Next-only entries or from `@/lib/navigation`, so
 * a TanStack Start route renders exactly the card the Next.js page renders.
 *
 * `form` and `sso` are slots rather than imports because *when* each arrives
 * differs by framework, not what it looks like. Next.js reads the deployment
 * configuration in a Server Component and hands each one down inside its own
 * `<Suspense>` (the skeletons live with the components they stand in for, so
 * both frameworks get them); a TanStack Start route has the same data from its
 * loader before this renders at all, and passes the finished elements.
 *
 * Everything else - the strings, the layout, the footer - is here once.
 */
export const SignInContent = ({
  LinkComponent,
  form,
  signUpHref = AUTH_HREF.signUp,
  sso,
}: {
  form: React.ReactNode;
  LinkComponent: AuthLinkComponent;
  signUpHref?: string;
  sso?: React.ReactNode;
}) => {
  const t = useTranslations("core.auth.sign_in");
  const tGlobal = useTranslations("core.global");

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-16 md:min-h-[calc(100vh-4rem)]">
      <Card className="bg-muted gap-0 p-0">
        <div className="bg-card rounded-xl p-6">
          <div className="mb-10 space-y-2 text-center">
            <h1 className="text-2xl leading-none font-semibold tracking-tight">
              {tGlobal("login")}
            </h1>
            <CardDescription>{t("desc")}</CardDescription>
          </div>

          {form}

          {sso}
        </div>

        <div className="text-accent-foreground p-6 text-center text-sm">
          {t.rich("do_not_have_account", {
            link: text => (
              <LinkComponent
                className="text-primary font-semibold"
                href={signUpHref}
              >
                {text}
              </LinkComponent>
            ),
          })}
        </div>
      </Card>
    </div>
  );
};
