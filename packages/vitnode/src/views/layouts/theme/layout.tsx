import type { VitNodeConfig } from '../../../vitnode.config';
import { HeaderLayout } from './header/header';

export const ThemeLayout = ({
  children,
  logo,
  vitNodeConfig,
}: React.ComponentProps<typeof HeaderLayout> & {
  children: React.ReactNode;
  vitNodeConfig: VitNodeConfig;
}) => {
  return (
    <>
      <HeaderLayout vitNodeConfig={vitNodeConfig} logo={logo} />{' '}
      <main>{children}</main>
    </>
  );
};
