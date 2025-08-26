import { Mail, MailboxIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const EmailConfirmationView = ({ email }: { email: string }) => {
  const t = useTranslations("core.auth.sign_up.email_confirmation");

  return (
    <Card className="w-full max-w-md p-6">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
          <MailboxIcon className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        <CardTitle className="text-2xl font-bold">{t("title")}</CardTitle>
        <CardDescription className="text-base">{t("desc")}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="bg-muted rounded-lg p-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">{email}</span>
            <Mail className="text-muted-foreground ml-auto size-5" />
          </div>
        </div>

        <p className="text-muted-foreground text-center text-sm">
          {t("check_spam")}
        </p>
      </CardContent>
    </Card>
  );
};
