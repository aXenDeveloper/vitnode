import { ThemeLayout } from 'vitnode-frontend/views/theme/layout/theme-layout';

import { Footer } from './footer';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ThemeLayout>{children}</ThemeLayout>
      <Footer />
    </>
  );
}
