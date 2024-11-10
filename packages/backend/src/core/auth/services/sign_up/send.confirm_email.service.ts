import { core_users_confirm_emails } from '@/database/schema/users';
import { getTranslationForEmail } from '@/helpers/email/email';
import { EmailHelperService } from '@/helpers/email/email.service';
import { type EmailHelpersServiceType } from '@/helpers/email/email-helpers.type';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';

import { ConfirmEmailTemplate } from '../confirm_email/confirm_email.email';

@Injectable()
export class SendConfirmEmailAuthService {
  constructor(
    private readonly databaseService: InternalDatabaseService,
    private readonly mailService: EmailHelperService,
    @Inject('EmailHelpersService')
    private readonly emailHelpersService: EmailHelpersServiceType,
  ) {}

  private async encryptToken(email: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const salt = crypto.randomBytes(4).toString('hex');

      crypto.scrypt(email, salt, 32, (err, derivedKey) => {
        if (err) reject(err);

        resolve(salt + ':' + derivedKey.toString('hex'));
      });
    });
  }

  async sendConfirmEmail({ userId }: { userId: number }) {
    const user = await this.databaseService.db.query.core_users.findFirst({
      where: (table, { eq }) => eq(table.id, userId),
      columns: {
        id: true,
        email: true,
        language: true,
        name: true,
        email_verified: true,
      },
      with: {
        confirm_email: true,
      },
    });

    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    if (user.email_verified) {
      throw new HttpException('Email already verified', HttpStatus.BAD_REQUEST);
    }

    // If user has confirm email, delete it
    if (user.confirm_email?.id) {
      // Skip if email was sent less than 10 minutes ago
      if (
        user.confirm_email.created_at > new Date(Date.now() - 1000 * 60 * 10)
      ) {
        return;
      }

      await this.databaseService.db
        .delete(core_users_confirm_emails)
        .where(eq(core_users_confirm_emails.id, user.confirm_email.id));
    }

    // Hash token
    const hashToken = await this.encryptToken(user.id.toString());

    // Save token
    await this.databaseService.db.insert(core_users_confirm_emails).values({
      user_id: user.id,
      token: hashToken,
      expires: new Date(Date.now() + 1000 * 60 * 60 * 12), // 12 hours
    });

    // Send email
    const t = getTranslationForEmail(
      'core.sign_up.confirm_email.mail',
      user.language,
    );
    await this.mailService.send({
      to: user.email,
      subject: t('subject'),
      message: ConfirmEmailTemplate({
        user,
        helpers: this.emailHelpersService.getHelpersForEmail(),
        token: hashToken,
      }),
      previewText: t('preview'),
      user,
    });
  }
}
