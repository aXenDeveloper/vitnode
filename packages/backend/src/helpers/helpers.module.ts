import {
  DynamicModule,
  Global,
  HttpException,
  HttpStatus,
  Module,
} from '@nestjs/common';

import { CaptchaHelper } from './captcha/captcha.service';
import { EmailService } from './email/email.service';
import { EmailHelpersService } from './email/email-helpers.service';
import {
  EmailSenderArgs,
  EmailSenderFunction,
} from './email/email-helpers.type';
import { StringLanguageHelper } from './string_language/helpers.service';

@Global()
@Module({})
export class GlobalHelpersModule {
  static register(options: { email?: EmailSenderFunction }): DynamicModule {
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
          provide: 'VITNODE_EMAIL_SENDER_IS_ENABLED',
          useValue: !!options.email,
        },
        EmailService,
        StringLanguageHelper,
        CaptchaHelper,
        {
          provide: 'EmailHelpersService',
          useClass: EmailHelpersService,
        },
      ],
      exports: [
        EmailService,
        StringLanguageHelper,
        CaptchaHelper,
        'EmailHelpersService',
      ],
    };
  }
}
