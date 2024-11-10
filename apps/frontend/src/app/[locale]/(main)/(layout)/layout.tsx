import { ThemeLayout } from 'vitnode-frontend/views/theme/layout/theme-layout';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <ThemeLayout>{children}</ThemeLayout>;
}
