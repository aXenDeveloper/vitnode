import createIntlMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';

import { getMiddlewareData } from './api/get-middleware-data';

const getI18n = async () => {
  try {
    const { languages: lang, authorization } = await getMiddlewareData();
    const languages = lang.filter(lang => lang.enabled);
    const defaultLanguage = lang.find(lang => lang.default)?.code ?? 'en';
    const i18n = {
      locales: languages.length > 0 ? languages.map(edge => edge.code) : ['en'],
      defaultLocale: defaultLanguage,
    };

    return {
      ...i18n,
      force_login: authorization.force_login,
    };
  } catch (_) {
    const i18n = {
      locales: ['en'],
      defaultLocale: 'en',
      force_login: false,
    };

    return i18n;
  }
};

const removeLocaleFromUrl = (urlPath: string, locales: string[]): string => {
  const parts = urlPath.split('/');
  if (parts[0] === '') {
    parts.shift();
  }

  if (locales.includes(parts[0])) {
    // Remove the locale
    parts.shift();
  }

  return `/${parts.join('/')}`;
};

export function createMiddleware() {
  return async function middleware(request: NextRequest) {
    const i18n = await getI18n();

    const handleI18nRouting = createIntlMiddleware({
      ...i18n,
      localePrefix: 'as-needed',
    });
    const pathname = removeLocaleFromUrl(
      request.nextUrl.pathname,
      i18n.locales,
    );
    const cookieSession = {
      default: request.cookies.get('vitnode-login-token'),
      admin: request.cookies.get('vitnode-login-token-admin'),
    };

    // Redirect if force login is true
    if (
      i18n.force_login &&
      !cookieSession.default &&
      !pathname.startsWith('/admin') &&
      !pathname.startsWith('/login') &&
      !pathname.startsWith('/register')
    ) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Redirect to /admin if the user is not logged in to AdminCP
    if (
      pathname.startsWith('/admin') &&
      pathname !== '/admin' &&
      pathname !== '/admin/theme-editor' &&
      pathname !== '/admin/install' &&
      !cookieSession.admin
    ) {
      return NextResponse.redirect(new URL('/admin', request.url));
    }

    return handleI18nRouting(request);
  };
}
