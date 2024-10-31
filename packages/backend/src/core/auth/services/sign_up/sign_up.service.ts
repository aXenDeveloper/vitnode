import { CaptchaHelper } from '@/helpers/captcha/captcha.service';
import { getConfigFile } from '@/helpers/config';
import { EmailHelperService } from '@/helpers/email/email.service';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { SignAuthObj, SignUpAuthBody } from 'vitnode-shared/auth.dto';

import { HelperSignUpAuthService } from './helper.service';
import { SendConfirmEmailAuthService } from './send.confirm_email.service';

@Injectable()
export class SignUpAuthService {
  constructor(
    private readonly captchaHelper: CaptchaHelper,
    private readonly signUpHelper: HelperSignUpAuthService,
    private readonly mailService: EmailHelperService,
    private readonly confirmEmailService: SendConfirmEmailAuthService,
  ) {}

  async signUp({
    req,
    body,
  }: {
    body: SignUpAuthBody;
    req: Request;
  }): Promise<SignAuthObj> {
    const config = getConfigFile();
    if (config.settings.authorization.lock_register) {
      throw new HttpException('Register is locked', HttpStatus.FORBIDDEN);
    }
    await this.captchaHelper.validateCaptcha({ req });
    const user = await this.signUpHelper.signUp({ req, body });

    if (
      config.settings.authorization.require_confirm_email &&
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
