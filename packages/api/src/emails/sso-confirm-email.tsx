import DefaultTemplateEmail, {
  type DefaultTemplateEmailProps,
} from "./default-template";
import { ActionLinkEmail } from "./ui/action-link-email";

interface SsoConfirmEmailTemplateProps extends DefaultTemplateEmailProps {
  confirmUrl: string;
  expiryDate: Date;
  userIpAddress?: string;
}

SsoConfirmEmailTemplate.PreviewProps = {
  ...DefaultTemplateEmail.PreviewProps,
  confirmUrl: "https://example.com/login/sso/reddit?confirm=abc123",
  expiryDate: new Date(Date.now() + 30 * 60 * 1000),
  userIpAddress: "192.168.1.1",
  i18n: {
    ...DefaultTemplateEmail.PreviewProps.i18n,
    messages: {
      core: {
        auth: {
          sso_confirm_email: {
            email: {
              subject: "Confirm your email to finish signing in",
              greeting: "Hello {name}!",
              intro:
                "Someone signed in with an account that didn't share a verified email address, and asked to use this one. Confirm it's yours to finish signing in.",
              button: "Confirm email and sign in",
              instructions:
                "Open the link in the same browser where you started signing in. It won't work anywhere else.",
              no_action:
                "If this wasn't you, ignore this email. Nobody can use your address without this link.",
              security_note:
                "For your security, this request was made from IP address: {ip}",
              help: "If you're having trouble with the button above, copy and paste the URL below into the same browser:",
              expire_time: "This link will expire on {date}",
            },
          },
        },
      },
    },
  },
} satisfies SsoConfirmEmailTemplateProps;

/**
 * The link that proves a visitor owns the address they typed after signing
 * in with a provider that shared no verified email. It only works in the
 * browser that started the sign-in.
 */
export default function SsoConfirmEmailTemplate({
  confirmUrl,
  ...props
}: SsoConfirmEmailTemplateProps) {
  return (
    <ActionLinkEmail
      {...props}
      actionUrl={confirmUrl}
      namespace="core.auth.sso_confirm_email.email"
    />
  );
}
