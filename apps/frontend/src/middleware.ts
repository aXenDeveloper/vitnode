import { createMiddleware } from 'vitnode-frontend/middleware';

export default createMiddleware();

export const config = {
  matcher:
    '/((?!_next|robots.txt|api|sw.js|sitemap.xml|robots.txt|favicon.ico).*)',
};
