import { Module } from '@nestjs/common';

import { AuthController } from './auth.controller';
import { AuthCron } from './auth.cron';
import { ClearTokenConfirmEmailAuthCron } from './services/confirm_email/clear_tokens_email.cron';
import { VerifyConfirmEmailAuthService } from './services/confirm_email/verify.service';
import { ShowAuthService } from './services/show.service';
import { HelperSignInAuthService } from './services/sign_in/helper.service';
import { SignInAuthService } from './services/sign_in/sign_in.service';
import { SignOutAuthService } from './services/sign_out.service';
import { HelperSignUpAuthService } from './services/sign_up/helper.service';
import { SendConfirmEmailAuthService } from './services/sign_up/send.confirm_email.service';
import { SignUpAuthService } from './services/sign_up/sign_up.service';
import { SettingsAuthModule } from './settings/settings.module';
import { SSOAuthModule } from './sso/sso.module';

@Module({
  providers: [
    HelperSignInAuthService,
    SendConfirmEmailAuthService,
    HelperSignUpAuthService,
  ],
  exports: [
    HelperSignInAuthService,
    SendConfirmEmailAuthService,
    HelperSignUpAuthService,
  ],
})
export class HelpersAuthModule {}

@Module({
  providers: [
    ShowAuthService,
    SignUpAuthService,
    AuthCron,
    ClearTokenConfirmEmailAuthCron,
    VerifyConfirmEmailAuthService,
    SignInAuthService,
    SignOutAuthService,
  ],
  controllers: [AuthController],
  imports: [SettingsAuthModule, SSOAuthModule, HelpersAuthModule],
})
export class AuthModule {}
