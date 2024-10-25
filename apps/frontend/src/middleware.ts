import { createMiddleware } from 'vitnode-frontend/middleware';

export default createMiddleware();

export const config = {
  matcher: '/((?!_next|robots.txt|sitemap.xml|sitemap).*)',
};
