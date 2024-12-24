import { InternalAuthService } from '@/helpers/auth/internal_auth.service';
import {
  DynamicModule,
  Global,
  HttpException,
  HttpStatus,
  Module,
} from '@nestjs/common';
import { LanguageModel } from 'ai';

import { AiHelperService } from './ai.service';
import { DeviceAuthService } from './auth/device.service';
import { InternalAuthAdminService } from './auth/internal_auth_admin.service';
import { SSOAuthHelper, SSOAuthItem } from './auth/sso/sso.service';
import { CaptchaConfig, CaptchaHelper } from './captcha.service';
import { ConfigHelperService } from './config.service';
import { EmailHelpersService } from './email/email-helpers.service';
import {
  EmailSenderArgs,
  EmailSenderFunction,
} from './email/email-helpers.type';
import { EmailHelperService } from './email/email.service';
import { FilesHelperService } from './files/files-helper.service';
import { StringLanguageHelper } from './string_language/helpers.service';
import { UserHelper } from './user.service';

@Global()
@Module({})
export class GlobalHelpersModule {
  static register(options: {
    ai?: LanguageModel;
    captcha?: CaptchaConfig;
    email?: EmailSenderFunction;
    ssoLoginMethod?: SSOAuthItem[];
  }): DynamicModule {
    return {
      module: GlobalHelpersModule,
      providers: [
        {
          provide: 'VITNODE_EMAIL_SENDER',
          useFactory: () => async (params: EmailSenderArgs) => {
            if (!options.email) {
              throw new HttpException(
                'Email sender is not enabled',
                HttpStatus.INTERNAL_SERVER_ERROR,
              );
            }

            await options.email(params);
          },
        },
        {
          provide: 'VITNODE_MODEL_AI',
          useValue: options.ai,
        },
        {
          provide: 'VITNODE_CAPTCHA_CONFIG',
          useValue: options.captcha,
        },
        {
          provide: 'VITNODE_SSO_LOGIN_METHODS',
          useValue: options.ssoLoginMethod ?? [],
        },
        {
          provide: 'VITNODE_EMAIL_SENDER_IS_ENABLED',
          useValue: !!options.email,
        },
        EmailHelperService,
        StringLanguageHelper,
        CaptchaHelper,
        {
          provide: 'IOAdminAuthGuards',
          useClass: InternalAuthAdminService,
        },
        {
          provide: 'EmailHelpersService',
          useClass: EmailHelpersService,
        },
        {
          provide: 'IOAuthGuards',
          useClass: InternalAuthService,
        },
        DeviceAuthService,
        UserHelper,
        FilesHelperService,
        SSOAuthHelper,
        ConfigHelperService,
        AiHelperService,
      ],
      exports: [
        EmailHelperService,
        StringLanguageHelper,
        CaptchaHelper,
        'EmailHelpersService',
        'IOAuthGuards',
        'IOAdminAuthGuards',
        'VITNODE_CAPTCHA_CONFIG',
        DeviceAuthService,
        UserHelper,
        FilesHelperService,
        SSOAuthHelper,
        ConfigHelperService,
        AiHelperService,
      ],
    };
  }
}
