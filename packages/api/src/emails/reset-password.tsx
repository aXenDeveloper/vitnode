import DefaultTemplateEmail, {
  type DefaultTemplateEmailProps,
} from "./default-template";
import { ActionLinkEmail } from "./ui/action-link-email";

interface ResetPasswordEmailTemplateProps extends DefaultTemplateEmailProps {
  expiryDate: Date;
  resetUrl: string;
  userIpAddress?: string;
}

ResetPasswordEmailTemplate.PreviewProps = {
  ...DefaultTemplateEmail.PreviewProps,
  resetUrl: "https://example.com/reset-password?token=abc123",
  expiryDate: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
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
          reset_password: {
            email: {
              subject: "Reset your password",
              greeting: "Hello {name}!",
              intro:
                "We received a request to reset your password for your account.",
              button: "Reset Password",
              instructions:
                "Click the button above to reset your password. This link will expire in 30 minutes for security reasons.",
              no_action:
                "If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.",
              security_note:
                "For your security, this request was made from IP address: {ip}",
              help: "If you're having trouble with the button above, copy and paste the URL below into your web browser:",
              expire_time: "This link will expire on {date}",
            },
          },
        },
      },
    },
  },
} satisfies ResetPasswordEmailTemplateProps;

export default function ResetPasswordEmailTemplate({
  resetUrl,
  ...props
}: ResetPasswordEmailTemplateProps) {
  return (
    <ActionLinkEmail
      {...props}
      actionUrl={resetUrl}
      namespace="core.auth.reset_password.email"
    />
  );
}
