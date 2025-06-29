import type { z } from 'zod';

import { useLocale, useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import React from 'react';
import { toast } from 'sonner';

import type { routeMiddlewareSchema } from '../api/modules/middleware/route';

export const useCaptcha = (
  captcha: z.infer<typeof routeMiddlewareSchema>['captcha'],
) => {
  const t = useTranslations('core.global.errors');
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

  const handleError = () => {
    toast.error(t('title'), {
      description: t('captcha_internal_error'),
    });
  };

  React.useEffect(() => {
    if (!captcha) return;
    const googleCaptchaDomain = `https://www.google.com/recaptcha/api.js?hl=${locale}`;

    // Load script
    const script = document.createElement('script');

    if (captcha.type === 'cloudflare_turnstile') {
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    } else if (captcha.type === 'recaptcha_v3') {
      script.src = `${googleCaptchaDomain}&render=${captcha.siteKey}`;
    }

    if (!script.src) return;
    document.body.appendChild(script);
    script.addEventListener('load', handleLoaded);
    script.addEventListener('error', handleError);

    return () => {
      script.removeEventListener('load', handleLoaded);
      script.removeEventListener('error', handleError);
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

  const getToken = async (): Promise<string> => {
    if (!captcha) return '';

    if (captcha.type === 'recaptcha_v3') {
      // Captcha
      return new Promise<string>(resolve => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        window.grecaptcha.ready(async () => {
          try {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            const token: string = await window.grecaptcha.execute(
              captcha.siteKey,
              {
                action: 'submit',
              },
            );

            resolve(token);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Captcha error', error);
          }

          resolve('');
        });
      });
    }

    return token;
  };

  return { isReady, onReset, getToken };
};
