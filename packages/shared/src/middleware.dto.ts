import { ApiProperty } from '@nestjs/swagger';

import { MainSettingsAdminBody } from './admin/settings/main.dto';
import { AllowTypeFilesEnum, CaptchaTypeEnum } from './utils/global';

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

  @ApiProperty()
  time_24: boolean;

  @ApiProperty()
  timezone: string;
}

export class CaptchaSecurityMiddleware {
  @ApiProperty()
  site_key: string;

  @ApiProperty({ enum: CaptchaTypeEnum })
  type: CaptchaTypeEnum;
}

export class SecurityMiddleware {
  @ApiProperty()
  captcha: CaptchaSecurityMiddleware;
}

class FilesEditorMiddleware {
  @ApiProperty({ enum: AllowTypeFilesEnum })
  allow_type: AllowTypeFilesEnum;
}

class EditorMiddleware {
  @ApiProperty()
  files: FilesEditorMiddleware;

  @ApiProperty()
  sticky: boolean;
}

export class ShowMiddlewareObj extends MainSettingsAdminBody {
  @ApiProperty()
  authorization: AuthorizationMiddleware;

  @ApiProperty()
  editor: EditorMiddleware;

  @ApiProperty()
  is_ai_enabled: boolean;

  @ApiProperty()
  is_email_enabled: boolean;

  @ApiProperty({ example: [{ code: 'en', default: true, enabled: true }] })
  languages: LanguagesMiddleware[];

  @ApiProperty()
  languages_code_default: string;

  @ApiProperty()
  plugin_code_default: string;

  @ApiProperty({ example: ['core', 'admin'] })
  plugins: string[];

  @ApiProperty()
  security: SecurityMiddleware;
}
