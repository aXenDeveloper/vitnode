import { core_logs_email } from '@/database/schema/logs';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { Inject, Injectable } from '@nestjs/common';
import { render } from '@react-email/render';
import React from 'react';

import { ConfigHelperService } from '../config.service';
import {
  type EmailHelpersServiceType,
  type EmailSenderFunction,
} from './email-helpers.type';
import { EmailTemplateProps } from './template/email-template';

@Injectable()
export class EmailHelperService {
  constructor(
    private readonly databaseService: InternalDatabaseService,
    @Inject('VITNODE_EMAIL_SENDER')
    private readonly emailSender: EmailSenderFunction,
    @Inject('VITNODE_EMAIL_SENDER_IS_ENABLED')
    private readonly isEmailEnabled: boolean,
    @Inject('EmailHelpersService')
    private readonly emailHelpersService: EmailHelpersServiceType,
    private readonly configHelper: ConfigHelperService,
  ) {}

  private async handleErrors({
    to,
    html,
    error,
    subject,
  }: {
    error: string;
    html: string;
    subject: string;
    to: string;
  }) {
    await this.databaseService.db.insert(core_logs_email).values({
      to,
      subject,
      error,
      html,
    });
  }

  private async processEmail({
    to,
    subject,
    template,
  }: {
    subject: string;
    template: Promise<React.ReactElement> | React.ReactElement;
    to: string;
  }): Promise<void> {
    const html = await Promise.resolve(render(await template));
    const config = await this.configHelper.getConfig();

    try {
      await this.emailSender({
        to,
        subject,
        html,
        site_short_name: config.site_short_name,
      });
    } catch (e) {
      const error = e as Error;
      await this.handleErrors({
        error: error.message,
        html,
        subject,
        to,
      });
    }
  }

  checkIfEnable(): boolean {
    return this.isEmailEnabled;
  }

  async send({
    to,
    subject,
    message,
    previewText,
    user,
  }: Pick<EmailTemplateProps, 'previewText' | 'user'> & {
    message: React.JSX.Element | string;
    subject: string;
    to: string;
  }): Promise<string> {
    await this.processEmail({
      to,
      subject,
      template: this.emailHelpersService.template({
        previewText,
        children: message,
        user,
      }),
    });

    return 'Email sent with Message!';
  }
}
