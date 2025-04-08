import { HeaderLayout } from './header/header';

export const ThemeLayout = ({
  children,
  logo,
}: React.ComponentProps<typeof HeaderLayout> & {
  children: React.ReactNode;
}) => {
  return (
    <>
      <HeaderLayout logo={logo} /> <main>{children}</main>
    </>
  );
};
