import { Header } from './header/header';
import { NavBarMobile } from './nav-bar-mobile/nav-bar-mobile';
import { getSessionData } from '@/api/get-session-data';

export const ThemeLayout = async ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { user } = await getSessionData();

  return (
    <>
      <Header />
      <div className="mb-14 sm:m-0">{children}</div>

      <div className="bg-background/75 fixed bottom-0 z-20 flex h-14 w-full border-t backdrop-blur sm:hidden">
        <NavBarMobile user={user} />
      </div>
    </>
  );
};
