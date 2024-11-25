import { forwardRef, Module } from '@nestjs/common';

import { HelpersAuthModule } from '../auth.module';
import { CallbackSSOAuthService } from './services/callback.service';
import { GetUrlSSOAuthService } from './services/get-url.service';
import { RegisterCallbackSSOAuthService } from './services/register-callback.service';
import { SSOAuthController } from './sso.controller';

@Module({
  providers: [
    GetUrlSSOAuthService,
    CallbackSSOAuthService,
    RegisterCallbackSSOAuthService,
  ],
  controllers: [SSOAuthController],
  imports: [forwardRef(() => HelpersAuthModule)],
})
export class SSOAuthModule {}
