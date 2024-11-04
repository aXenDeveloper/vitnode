import { AuthLayout } from 'vitnode-frontend/views/layout/auth/auth-layout';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AuthLayout>{children}</AuthLayout>;
}
