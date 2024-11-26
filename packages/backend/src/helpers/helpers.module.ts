import { InternalAuthService } from '@/helpers/auth/internal_auth.service';
import {
  DynamicModule,
  Global,
  HttpException,
  HttpStatus,
  Module,
} from '@nestjs/common';

import { DeviceAuthService } from './auth/device.service';
import { InternalAuthAdminService } from './auth/internal_auth_admin.service';
import { SSOAuthHelper, SSOAuthItem } from './auth/sso.service';
import { CaptchaHelper } from './captcha/captcha.service';
import { EmailHelperService } from './email/email.service';
import { EmailHelpersService } from './email/email-helpers.service';
import {
  EmailSenderArgs,
  EmailSenderFunction,
} from './email/email-helpers.type';
import { FilesHelperService } from './files/files-helper.service';
import { StringLanguageHelper } from './string_language/helpers.service';
import { UserHelper } from './user.service';

@Global()
@Module({})
export class GlobalHelpersModule {
  static register(options: {
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
      ],
      exports: [
        EmailHelperService,
        StringLanguageHelper,
        CaptchaHelper,
        'EmailHelpersService',
        'IOAuthGuards',
        'IOAdminAuthGuards',
        DeviceAuthService,
        UserHelper,
        FilesHelperService,
        SSOAuthHelper,
      ],
    };
  }
}
