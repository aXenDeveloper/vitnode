import type { z } from 'zod';

import { useLocale } from 'next-intl';
import { useTheme } from 'next-themes';
import React from 'react';

import type { routeMiddlewareSchema } from '../api/modules/middleware/route';

export const useCaptcha = (
  captcha: z.infer<typeof routeMiddlewareSchema>['captcha'],
) => {
  const locale = useLocale();
  const { resolvedTheme } = useTheme();
  const [isReady, setIsReady] = React.useState(false);
  const [token, setToken] = React.useState('');

  const handleLoaded = () => {
    if (!captcha) return;

    const elementId = 'vitnode_captcha';

    if (captcha.type === 'cloudflare_turnstile') {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      window.turnstile.render(`#${elementId}`, {
        sitekey: captcha.siteKey,
        theme: resolvedTheme,
        language: locale,
        callback: (token: string) => {
          setToken(token);
        },
      });
    }

    setIsReady(true);
  };

  React.useEffect(() => {
    if (!captcha) return;

    // Load script
    const script = document.createElement('script');

    if (captcha.type === 'cloudflare_turnstile') {
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    }

    if (!script.src) return;
    document.body.appendChild(script);
    script.addEventListener('load', handleLoaded);

    return () => {
      script.removeEventListener('load', handleLoaded);
      document.body.removeChild(script);
    };
    // eslint-disable-next-line react-compiler/react-compiler
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onReset = () => {
    if (!captcha) return;

    if (captcha.type === 'cloudflare_turnstile') {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      window.turnstile.reset();
    }

    setToken('');
  };

  return { isReady, token, onReset };
};
