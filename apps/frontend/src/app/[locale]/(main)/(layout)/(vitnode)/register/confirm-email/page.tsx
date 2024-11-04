import {
  ConfirmEmailSignUpView,
  metadataConfirmEmailSignUp,
} from 'vitnode-frontend/views/theme/views/auth/sign/up/confirm-email/confirm-email-sign-up-view';

export const metadata = metadataConfirmEmailSignUp;

export default function Page(
  props: React.ComponentProps<typeof ConfirmEmailSignUpView>,
) {
  return <ConfirmEmailSignUpView {...props} />;
}
