'use client';

import { createNavigation } from 'next-intl/navigation';
import { useSearchParams } from 'next/navigation';
import NProgress from 'nprogress';
import React from 'react';

const { useRouter: useRouterI18n, usePathname } = createNavigation();

const useRouter = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouterI18n();
  const { push } = router;

  // eslint-disable-next-line react-compiler/react-compiler
  router.push = (href, options) => {
    NProgress.start();
    push(href, options);
  };

  React.useEffect(() => {
    NProgress.done();
  }, [pathname, searchParams]);

  return router;
};

export { usePathname, useRouter };
