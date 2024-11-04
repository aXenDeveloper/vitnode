import {
  generateMetadataSignIn,
  SignInView,
} from 'vitnode-frontend/views/theme/views/auth/sign/in/sign-in-view';

export const generateMetadata = generateMetadataSignIn;

export default function Page() {
  return <SignInView />;
}
