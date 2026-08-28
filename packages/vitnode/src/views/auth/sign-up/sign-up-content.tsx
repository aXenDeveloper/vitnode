"use client";

import { useTranslations } from "use-intl";

import { Card, CardDescription } from "@/components/ui/card";

import type { AuthLinkComponent } from "../auth-link";

import { AUTH_HREF } from "../auth-link";
import { WrapperSignUp } from "./wrapper";

/**
 * The registration card - the heading, the copy, and the two slots that fill it.
 *
 * The counterpart of `SignInContent`, and framework-free for the same reason: it
 * reaches nothing from `next/*`, from `next-intl`'s Next-only entries or from
 * `@/lib/navigation`, so a TanStack Start route renders exactly the card the
 * Next.js page renders.
 *
 * `form` and `sso` are slots rather than imports because *when* each arrives
 * differs by framework, not what it looks like. Next.js reads the deployment
 * configuration in a Server Component and hands each one down inside its own
 * `<Suspense>`; a TanStack Start route has the same data from its loader before
 * this renders at all, and passes the finished elements.
 *
 * ## Why the wrapper is inside
 *
 * {@link WrapperSignUp} is here rather than left to each caller because the
 * "check your email" screen *replaces this card*, and a caller that forgot to
 * mount it would get a form that succeeds and then appears to do nothing. It is
 * ordinary client React - `useState` and a context - so both frameworks mount
 * the same one, and the confirmation state lives exactly one level above the
 * thing it hides.
 */
export const SignUpContent = ({
  form,
  LinkComponent,
  signInHref = AUTH_HREF.signIn,
  sso,
}: {
  form: React.ReactNode;
  LinkComponent: AuthLinkComponent;
  signInHref?: string;
  sso?: React.ReactNode;
}) => {
  const t = useTranslations("core.auth.sign_up");
  const tGlobal = useTranslations("core.global");

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-16 md:min-h-[calc(100vh-4rem)]">
      <WrapperSignUp>
        <Card className="bg-muted gap-0 p-0">
          <div className="bg-card rounded-xl p-6">
            <div className="mb-10 space-y-2 text-center">
              <h1 className="text-2xl leading-none font-semibold tracking-tight">
                {tGlobal("register")}
              </h1>
              <CardDescription>{t("desc")}</CardDescription>
            </div>

            {form}

            {sso}
          </div>

          <div className="text-accent-foreground p-6 text-center text-sm">
            {t.rich("already_have_account", {
              link: text => (
                <LinkComponent
                  className="text-primary font-semibold"
                  href={signInHref}
                >
                  {text}
                </LinkComponent>
              ),
            })}
          </div>
        </Card>
      </WrapperSignUp>
    </div>
  );
};
