import { I18nProvider } from "@/components/i18n-provider";
import { LogoVitNode } from "@/components/logo-vitnode";
import { Card } from "@/components/ui/card";
import {
  ADMIN_REDIRECT_PARAM,
  sanitizeAdminRedirect,
} from "@/lib/admin-redirect";
import { FormSignIn } from "@/views/auth/sign-in/form/form";

export const SignInAdminView = async ({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const redirectParam = (await searchParams)?.[ADMIN_REDIRECT_PARAM];

  return (
    <I18nProvider namespaces={["core.auth.sign_in"]}>
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-10 px-4 py-16">
        <LogoVitNode className="w-64" />
        <Card className="w-full p-6">
          <FormSignIn
            isAdmin
            isEmail={false}
            redirectTo={sanitizeAdminRedirect(
              typeof redirectParam === "string" ? redirectParam : undefined,
            )}
          />
        </Card>
      </div>
    </I18nProvider>
  );
};
