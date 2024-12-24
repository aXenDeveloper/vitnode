import type { EmailHelpersServiceType } from '@/helpers/email/email-helpers.type';
import type { Request } from 'express';

import { core_users_forgot_password } from '@/database/schema/users';
import { getUserIp } from '@/functions';
import { CaptchaHelper } from '@/helpers/captcha.service';
import { getTranslationForEmail } from '@/helpers/email/email';
import { EmailHelperService } from '@/helpers/email/email.service';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { SendForgotPasswordAuthBody } from 'vitnode-shared/auth/auth.dto';

import { VerifyForgotPasswordAuthService } from '../verify.service';
import { SendForgotPasswordTemplateEmail } from './send.email';

@Injectable()
export class SendForgotPasswordAuthService {
  constructor(
    private readonly captchaHelper: CaptchaHelper,
    private readonly databaseService: InternalDatabaseService,
    private readonly mailService: EmailHelperService,
    private readonly verifyService: VerifyForgotPasswordAuthService,
    @Inject('EmailHelpersService')
    private readonly emailHelpersService: EmailHelpersServiceType,
  ) {}

  async send({
    req,
    body: { email: emailFromArgs },
  }: {
    body: SendForgotPasswordAuthBody;
    req: Request;
  }): Promise<void> {
    const isEmailEnable = this.mailService.checkIfEnable();
    if (!isEmailEnable) return;

    const email = emailFromArgs.toLowerCase();
    await this.captchaHelper.validateCaptcha({ req });

    const user = await this.databaseService.db.query.core_users.findFirst({
      where: (table, { eq, and }) =>
        and(eq(table.email, email), eq(table.email_verified, true)),
      columns: {
        id: true,
        name: true,
        email: true,
        language: true,
      },
      with: {
        forgot_password: true,
      },
    });
    if (!user) return;

    const token = await this.verifyService.encryptToken(user.email);
    if (user.forgot_password) {
      await this.databaseService.db
        .update(core_users_forgot_password)
        .set({
          token,
          ip_address: getUserIp(req),
          expires_at: new Date(Date.now() + 1000 * 60 * 15), // 15 minutes
        })
        .where(eq(core_users_forgot_password.user_id, user.id));
    } else {
      await this.databaseService.db.insert(core_users_forgot_password).values({
        user_id: user.id,
        token,
        ip_address: getUserIp(req),
        expires_at: new Date(Date.now() + 1000 * 60 * 15), // 15 minutes
      });
    }

    const t = getTranslationForEmail(
      'core.sign_in.forgot_password.content_email',
      user.language,
    );
    await this.mailService.send({
      to: user.email,
      subject: t('subject'),
      message: SendForgotPasswordTemplateEmail({
        user,
        token,
        helpers: await this.emailHelpersService.getHelpersForEmail(),
      }),
      previewText: t('preview'),
      user,
    });
  }
}
