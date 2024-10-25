import {
  generateMetadataSignUp,
  SignUpView,
} from 'vitnode-frontend/views/theme/views/auth/sign/up/sign-up-view';

export const generateMetadata = generateMetadataSignUp;

export default function Page() {
  return <SignUpView />;
}
