import { getUserIp } from '@/functions';
import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';

export interface CaptchaConfig {
  secret_key: string;
  site_key: string;
  type:
    | 'cloudflare_turnstile'
    | 'recaptcha_v2_checkbox'
    | 'recaptcha_v2_invisible'
    | 'recaptcha_v3';
}

@Injectable()
export class CaptchaHelper {
  constructor(
    @Inject('VITNODE_CAPTCHA_CONFIG')
    private readonly captchaConfig?: CaptchaConfig,
  ) {}

  private async getResFromReCaptcha({
    captchaKey,
    userIp,
  }: {
    captchaKey: string | string[];
    userIp: string;
  }): Promise<{ 'error-codes'?: string[]; score: number; success: boolean }> {
    if (!this.captchaConfig) {
      return {
        success: true,
        score: 1,
      };
    }

    if (this.captchaConfig.type === 'cloudflare_turnstile') {
      const res = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          method: 'POST',
          body: JSON.stringify({
            secret: this.captchaConfig.secret_key,
            response: captchaKey,
            remoteip: userIp,
          }),
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      const data = await res.json();

      return data;
    } else if (
      [
        'recaptcha_v2_checkbox',
        'recaptcha_v2_invisible',
        'recaptcha_v3',
      ].includes(this.captchaConfig.type)
    ) {
      const res = await fetch(
        `https://www.google.com/recaptcha/api/siteverify?secret=${this.captchaConfig.secret_key}&response=${captchaKey}&remoteip=${userIp}`,
        {
          method: 'POST',
        },
      );

      const data = await res.json();

      return data;
    }

    return {
      success: false,
      score: 0,
    };
  }

  async validateCaptcha({ req }: { req: Request }) {
    const captchaKey = req.headers['x-vitnode-captcha-token'];
    if (!captchaKey && this.captchaConfig) {
      throw new HttpException(
        'Captcha token not provided',
        HttpStatus.BAD_REQUEST,
      );
    }

    const userIp = getUserIp(req);
    const res = await this.getResFromReCaptcha({
      // Allow non-null assertion because we check if it's not provided. Specific to this case.
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      captchaKey: captchaKey!,
      userIp,
    });

    if (!res.success || res.score < 0.5) {
      throw new HttpException('CAPTCHA_FAILED', HttpStatus.UNAUTHORIZED);
    }
  }
}
