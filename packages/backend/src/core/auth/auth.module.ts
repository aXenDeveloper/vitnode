import { Module } from '@nestjs/common';

import { AuthController } from './auth.controller';
import { AuthCron } from './auth.cron';
import { ClearTokenConfirmEmailAuthCron } from './services/confirm_email/clear_tokens_email.cron';
import { VerifyConfirmEmailAuthService } from './services/confirm_email/verify.service';
import { ShowAuthService } from './services/show.service';
import { SignInAuthService } from './services/sign_in.service';
import { SignOutAuthService } from './services/sign_out.service';
import { HelperSignUpAuthService } from './services/sign_up/helper.service';
import { SendConfirmEmailAuthService } from './services/sign_up/send.confirm_email.service';
import { SignUpAuthService } from './services/sign_up/sign_up.service';
import { SettingsAuthModule } from './settings/settings.module';

@Module({
  providers: [
    ShowAuthService,
    SignUpAuthService,
    HelperSignUpAuthService,
    AuthCron,
    ClearTokenConfirmEmailAuthCron,
    SendConfirmEmailAuthService,
    VerifyConfirmEmailAuthService,
    SignInAuthService,
    SignOutAuthService,
  ],
  controllers: [AuthController],
  imports: [SettingsAuthModule],
})
export class AuthModule {}
