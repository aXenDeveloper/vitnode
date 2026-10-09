import DefaultTemplateEmail, {
  type DefaultTemplateEmailProps,
} from "./default-template";
import { ActionLinkEmail } from "./ui/action-link-email";

interface VerifyEmailTemplateProps extends DefaultTemplateEmailProps {
  expiryDate: Date;
  userIpAddress?: string;
  verifyUrl: string;
}

VerifyEmailTemplate.PreviewProps = {
  ...DefaultTemplateEmail.PreviewProps,
  verifyUrl: "https://example.com/login/verify-email?token=abc123",
  expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
  userIpAddress: "192.168.1.1",
  user: {
    id: 1,
    name: "John Doe",
    email: "john@example.com",
    language: "en",
    nameCode: "john-doe",
  },
  i18n: {
    ...DefaultTemplateEmail.PreviewProps.i18n,
    messages: {
      core: {
        auth: {
          verify_email: {
            email: {
              subject: "Confirm your email address",
              greeting: "Hello {name}!",
              intro:
                "Thanks for signing up! Confirm that this is your email address to finish creating your account.",
              button: "Confirm email address",
              instructions:
                "Click the button above to confirm your email address. You can sign in as soon as it's confirmed.",
              no_action:
                "If you didn't create an account, you can safely ignore this email - nobody can sign in with this address until it's confirmed.",
              security_note:
                "For your security, this account was created from IP address: {ip}",
              help: "If you're having trouble with the button above, copy and paste the URL below into your web browser:",
              expire_time: "This link will expire on {date}",
            },
          },
        },
      },
    },
  },
} satisfies VerifyEmailTemplateProps;

export default function VerifyEmailTemplate({
  verifyUrl,
  ...props
}: VerifyEmailTemplateProps) {
  return (
    <ActionLinkEmail
      {...props}
      actionUrl={verifyUrl}
      namespace="core.auth.verify_email.email"
    />
  );
}
