/* eslint-disable @eslint-react/hooks-extra/no-direct-set-state-in-use-effect */

import type { z } from 'zod';

import { useLocale, useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import React from 'react';
import { toast } from 'sonner';

import { usePathname } from '@/lib/navigation';

import type { routeMiddlewareSchema } from '../api/modules/middleware/route';

export const useCaptcha = (
  captcha: z.infer<typeof routeMiddlewareSchema>['captcha'],
) => {
  const t = useTranslations('core.global.errors');
  const locale = useLocale();
  const { resolvedTheme } = useTheme();
  const [isReady, setIsReady] = React.useState(false);
  const [token, setToken] = React.useState('');
  const pathname = usePathname();

  const handleLoaded = () => {
    if (!captcha) return;

    const elementId = 'vitnode_captcha';

    if (captcha.type === 'cloudflare_turnstile') {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      window.turnstile.render(`#${elementId}`, {
        sitekey: captcha.siteKey,
        theme: resolvedTheme,
        language: locale,
        callback: (token: string) => {
          setToken(token);
          // ✅ Set isReady to true ONLY when the token is received
          setIsReady(true);
        },
        // Optional: Add more callbacks for a better user experience
        'expired-callback': () => {
          onReset();
        },
      });
    } else {
      // For reCAPTCHA, the script being loaded means it's ready.
      setIsReady(true);
    }
  };

  const handleError = () => {
    toast.error(t('title'), {
      description: t('captcha_internal_error'),
    });
  };

  React.useEffect(() => {
    if (!captcha) {
      // If no captcha is required, consider it "ready"
      setIsReady(true);

      return;
    }
    // Reset state on captcha type change
    setIsReady(false);

    setToken('');

    const googleCaptchaDomain = `https://www.google.com/recaptcha/api.js?hl=${locale}`;

    const script = document.createElement('script');

    if (captcha.type === 'cloudflare_turnstile') {
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    } else if (captcha.type === 'recaptcha_v3') {
      script.src = `${googleCaptchaDomain}&render=${captcha.siteKey}`;
    }

    if (!script.src) return;

    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
    script.addEventListener('load', handleLoaded);
    script.addEventListener('error', handleError);

    return () => {
      script.removeEventListener('load', handleLoaded);
      script.removeEventListener('error', handleError);
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
      // Clean up the captcha widget if it exists
      const widget = document.getElementById('vitnode_captcha');
      if (widget) {
        widget.innerHTML = '';
      }
    };
  }, [pathname, locale, captcha?.type, captcha?.siteKey]);

  const onReset = () => {
    if (!captcha) return;

    if (captcha.type === 'cloudflare_turnstile') {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      if (window.turnstile) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        window.turnstile.reset();
      }
    }

    setToken('');
    setIsReady(false);
  };

  const getToken = async (): Promise<string> => {
    if (!captcha) return '';

    if (captcha.type === 'recaptcha_v3') {
      return new Promise<string>(resolve => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        window.grecaptcha.ready(async () => {
          try {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
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
            resolve('');
          }
        });
      });
    }

    return token;
  };

  return { isReady, onReset, getToken };
};
