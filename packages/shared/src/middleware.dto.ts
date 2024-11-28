import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

import { MainSettingsAdminBody } from './admin/settings/main.dto';
import { ShowNavStyles } from './nav.dto';
import { FileObj } from './utils/files.dto';
import { AllowTypeFilesEnum, CaptchaTypeEnum } from './utils/global';

class EditorMiddleware {
  @ApiProperty()
  files: FilesEditorMiddleware;

  @ApiProperty()
  sticky: boolean;
}

export class SSOAuthMethodMiddleware {
  @ApiProperty()
  @IsString()
  code: string;

  @ApiProperty()
  @IsString()
  name: string;
}

class FilesEditorMiddleware {
  @ApiProperty({ enum: AllowTypeFilesEnum })
  allow_type: AllowTypeFilesEnum;
}

export class AuthMethodMiddleware {
  @ApiProperty()
  @IsBoolean()
  password: boolean;

  @ApiProperty({ type: [SSOAuthMethodMiddleware] })
  sso: SSOAuthMethodMiddleware[];
}

export class AuthorizationMiddleware {
  @ApiProperty()
  force_login: boolean;

  @ApiProperty()
  lock_register: boolean;
}

export class CaptchaSecurityMiddleware {
  @ApiProperty()
  @IsString()
  site_key: string;

  @ApiProperty({ enum: CaptchaTypeEnum })
  @IsEnum(CaptchaTypeEnum)
  type: CaptchaTypeEnum;
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

export class LogosMiddleware {
  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  logo_dark?: FileObj;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  logo_light?: FileObj;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  mobile_logo_dark?: FileObj;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  mobile_logo_light?: FileObj;

  @ApiProperty()
  @IsNumber()
  mobile_width: number;

  @ApiProperty()
  @IsString()
  text: string;

  @ApiProperty()
  @IsNumber()
  width: number;
}

export class SecurityMiddleware {
  @ApiProperty()
  captcha: CaptchaSecurityMiddleware;
}

export class ShowMiddlewareObj extends MainSettingsAdminBody {
  @ApiProperty()
  auth_methods: AuthMethodMiddleware;

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
  logos: LogosMiddleware;

  @ApiProperty({ type: [ShowNavStyles] })
  nav: ShowNavStyles[];

  @ApiProperty()
  plugin_code_default: string;

  @ApiProperty({ example: ['core', 'admin'] })
  plugins: string[];

  @ApiProperty()
  security: SecurityMiddleware;
}
