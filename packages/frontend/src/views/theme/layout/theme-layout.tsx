import { Header } from './header/header';

export const ThemeLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <Header />
      {children}
      {/* <Footer />
      <QuickMenu /> */}
    </>
  );
};
