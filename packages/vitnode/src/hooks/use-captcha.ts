/* eslint-disable react-you-might-not-need-an-effect/no-external-store-subscription */
/* eslint-disable @eslint-react/set-state-in-effect */
/* eslint-disable react-you-might-not-need-an-effect/no-adjust-state-on-prop-change */
import type { z } from "zod";

import React from "react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "use-intl";

import { useTheme } from "@/components/theme-provider";

import type { routeMiddlewareSchema } from "../api/modules/middleware/route";

declare global {
  interface Window {
    grecaptcha?: {
      execute: (
        siteKey: string,
        options: { action: string },
      ) => Promise<string>;
      ready: (callback: () => void) => void;
    };
    turnstile?: {
      render: (
        container: string,
        params: {
          callback: (token: string) => void;
          "expired-callback": () => void;
          language: string;
          sitekey: string;
          theme: string | undefined;
        },
      ) => string;
      reset: () => void;
    };
  }
}

export const useCaptcha = (
  captcha: z.infer<typeof routeMiddlewareSchema>["captcha"],
) => {
  const t = useTranslations("core.global.errors");
  const locale = useLocale();
  const { resolvedTheme } = useTheme();
  const [isReady, setIsReady] = React.useState(false);
  const [token, setToken] = React.useState("");

  const onReset = () => {
    if (!captcha) return;

    if (captcha.type === "cloudflare_turnstile" && window.turnstile) {
      window.turnstile.reset();
    }

    setToken("");
    setIsReady(false);
  };

  const handleLoaded = () => {
    if (!captcha) return;

    const elementId = "vitnode_captcha";

    if (captcha.type === "cloudflare_turnstile" && window.turnstile) {
      window.turnstile.render(`#${elementId}`, {
        sitekey: captcha.siteKey,
        theme: resolvedTheme,
        language: locale,
        callback: (token: string) => {
          setToken(token);
          setIsReady(true);
        },
        "expired-callback": () => {
          onReset();
        },
      });
    } else {
      // For reCAPTCHA, the script being loaded means it's ready.
      setIsReady(true);
    }
  };

  const handleError = () => {
    toast.error(t("title"), {
      description: t("captcha_internal_error"),
    });
  };

  React.useEffect(() => {
    if (!captcha) {
      // If no captcha is required, consider it "ready"
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsReady(true);

      return;
    }
    setIsReady(false);

    setToken("");

    const googleCaptchaDomain = `https://www.google.com/recaptcha/api.js?hl=${locale}`;

    const script = document.createElement("script");

    if (captcha.type === "cloudflare_turnstile") {
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    } else if (captcha.type === "recaptcha_v3") {
      script.src = `${googleCaptchaDomain}&render=${captcha.siteKey}`;
    }

    if (!script.src) return;

    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
    script.addEventListener("load", handleLoaded);
    script.addEventListener("error", handleError);

    return () => {
      script.removeEventListener("load", handleLoaded);
      script.removeEventListener("error", handleError);
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
      const widget = document.getElementById("vitnode_captcha");
      if (widget) {
        widget.innerHTML = "";
      }
    };
    // eslint-disable-next-line @eslint-react/exhaustive-deps
  }, [locale, captcha?.type, captcha?.siteKey]);

  const getToken = async (): Promise<string> => {
    if (!captcha) return "";

    if (captcha.type === "recaptcha_v3") {
      return await new Promise<string>(resolve => {
        const grecaptcha = window.grecaptcha;
        if (grecaptcha) {
          grecaptcha.ready(async () => {
            try {
              const token: string = await grecaptcha.execute(captcha.siteKey, {
                action: "submit",
              });
              resolve(token);
            } catch (error) {
              // eslint-disable-next-line no-console
              console.error("Captcha error", error);
              resolve("");
            }
          });
        } else {
          resolve("");
        }
      });
    }

    return token;
  };

  return { isReady, onReset, getToken };
};
