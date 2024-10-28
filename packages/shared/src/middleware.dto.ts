import { ApiProperty } from '@nestjs/swagger';

import { MainSettingsAdminBody } from './admin/settings.dto';
import { CaptchaTypeEnum } from './utils/global';

export class AuthorizationMiddleware {
  @ApiProperty()
  force_login: boolean;

  @ApiProperty()
  lock_register: boolean;
}

export class LanguagesMiddleware {
  @ApiProperty()
  allow_in_input: boolean;

  @ApiProperty()
  code: string;

  @ApiProperty()
  default: boolean;

  @ApiProperty()
  enabled: boolean;

  @ApiProperty()
  name: string;
}

export class CaptchaSecurityMiddleware {
  @ApiProperty()
  site_key: string;

  @ApiProperty({ enum: CaptchaTypeEnum, name: 'CaptchaTypeEnum' })
  type: CaptchaTypeEnum;
}

export class SecurityMiddleware {
  @ApiProperty()
  captcha: CaptchaSecurityMiddleware;
}

export class ShowMiddlewareObj extends MainSettingsAdminBody {
  @ApiProperty()
  authorization: AuthorizationMiddleware;

  @ApiProperty()
  is_ai_enabled: boolean;

  @ApiProperty()
  is_email_enabled: boolean;

  @ApiProperty({ example: [{ code: 'en', default: true, enabled: true }] })
  languages: LanguagesMiddleware[];

  @ApiProperty()
  plugin_code_default: string;

  @ApiProperty({ example: ['core', 'admin'] })
  plugins: string[];

  @ApiProperty()
  security: SecurityMiddleware;
}
