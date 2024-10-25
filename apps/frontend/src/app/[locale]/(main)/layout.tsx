import { AuthLayout } from 'vitnode-frontend/views/layout/auth/auth-layout';
import { ThemeLayout } from 'vitnode-frontend/views/theme/layout/theme-layout';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AuthLayout>
      <ThemeLayout>{children}</ThemeLayout>
    </AuthLayout>
  );
}
