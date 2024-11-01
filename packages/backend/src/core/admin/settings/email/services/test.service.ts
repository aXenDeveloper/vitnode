import { EmailHelperService } from '@/helpers/email/email.service';
import { Injectable } from '@nestjs/common';
import { TestEmailSettingsAdminBody } from 'vitnode-shared/admin/settings/email.dto';
import { User } from 'vitnode-shared/user.dto';

@Injectable()
export class TestEmailSettingsAdminService {
  constructor(private readonly mailService: EmailHelperService) {}

  async test({
    body: { to, subject, message, preview_text },
    user,
  }: {
    body: TestEmailSettingsAdminBody;
    user: User;
  }): Promise<void> {
    await this.mailService.send({
      to,
      subject,
      message,
      previewText: preview_text,
      user,
    });
  }
}
