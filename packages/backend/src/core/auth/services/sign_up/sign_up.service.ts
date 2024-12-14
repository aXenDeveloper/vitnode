import { CaptchaHelper } from '@/helpers/captcha/captcha.service';
import { ConfigHelperService } from '@/helpers/config.service';
import { EmailHelperService } from '@/helpers/email/email.service';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { SignAuthObj, SignUpAuthBody } from 'vitnode-shared/auth/auth.dto';

import { HelperSignUpAuthService } from './helper.service';
import { SendConfirmEmailAuthService } from './send.confirm_email.service';

@Injectable()
export class SignUpAuthService {
  constructor(
    private readonly captchaHelper: CaptchaHelper,
    private readonly signUpHelper: HelperSignUpAuthService,
    private readonly mailService: EmailHelperService,
    private readonly confirmEmailService: SendConfirmEmailAuthService,
    private readonly configHelper: ConfigHelperService,
  ) {}

  async signUp({
    req,
    body,
  }: {
    body: SignUpAuthBody;
    req: Request;
  }): Promise<SignAuthObj> {
    const config = await this.configHelper.getConfig();
    if (config.auth_lock_register) {
      throw new HttpException('Register is locked', HttpStatus.FORBIDDEN);
    }
    await this.captchaHelper.validateCaptcha({ req });
    const user = await this.signUpHelper.signUp({ req, body });

    if (
      config.auth_require_confirm_email &&
      !user.email_verified &&
      this.mailService.checkIfEnable()
    ) {
      await this.confirmEmailService.sendConfirmEmail({
        userId: user.id,
      });
    }

    return user;
  }
}
