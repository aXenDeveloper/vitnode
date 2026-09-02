import type { Context, Next } from "hono";

import { HTTPException } from "hono/http-exception";

import type { VitNodeApiConfig } from "../../vitnode.config";

const getResFromReCaptcha = async ({
  token,
  userIp,
  captchaConfig,
}: {
  captchaConfig: NonNullable<Pick<VitNodeApiConfig, "captcha">["captcha"]>;
  token: string;
  userIp: string;
}): Promise<{ "error-codes"?: string[]; score: number; success: boolean }> => {
  // An install that configured a captcha but no secret key cannot verify
  // anything. Said here rather than left to the provider to reject a malformed
  // request: the answer is the same either way, but only one of them is a
  // decision this code made on purpose.
  const { secretKey } = captchaConfig;
  if (!secretKey) {
    return { success: false, score: 0, "error-codes": ["missing-secret-key"] };
  }

  if (captchaConfig.type === "cloudflare_turnstile") {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: JSON.stringify({
          secret: secretKey,
          response: token,
          remoteip: userIp,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    const data: {
      "error-codes"?: string[];
      success: boolean;
    } = await res.json();

    return {
      success: data.success,
      score: data.success ? 1 : 0,
      "error-codes": data["error-codes"],
    };
  }
  if (captchaConfig.type === "recaptcha_v3") {
    // Form-encoded body rather than a query string. Interpolating the
    // client-supplied token straight into the URL let it carry `&` and add
    // parameters of its own to the request - and it put the site's secret key in
    // a URL, which is the part of a request that ends up in proxy logs and
    // error reports.
    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
        remoteip: userIp,
      }),
    });

    const data: {
      "error-codes"?: string[];
      score: number;
      success: boolean;
    } = await res.json();

    return {
      success: data.success,
      score: data.score ?? 0,
      "error-codes": data["error-codes"],
    };
  }

  return {
    success: false,
    score: 0,
  };
};

export const captchaMiddleware = () => {
  return async (c: Context, next: Next) => {
    const token = c.req.header("x-vitnode-captcha-token");
    const captchaConfig = c.get("core").captcha;
    if (!captchaConfig) {
      await next();

      return;
    }

    if (!token) {
      throw new HTTPException(400, {
        message: "Captcha token is required",
      });
    }

    const res = await getResFromReCaptcha({
      token,
      userIp: c.get("ipAddress"),
      captchaConfig,
    });

    if (!res.success || res.score < 0.5) {
      throw new HTTPException(400, {
        message: "Captcha validation failed",
      });
    }

    await next();
  };
};
