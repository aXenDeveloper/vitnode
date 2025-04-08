import { LogoVitNode } from 'vitnode/components/logo-vitnode';
import { ThemeLayout } from 'vitnode/views/layouts/theme/layout';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeLayout logo={<LogoVitNode className="w-34" />}>
      {children}
    </ThemeLayout>
  );
}
