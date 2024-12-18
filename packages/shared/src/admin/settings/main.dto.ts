import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

import { StringLanguage } from '../../string-language.dto';
import { AppTypeMainSettingsAdmin } from './main.enum';

export class MainSettingsAdminBody {
  @ApiProperty({
    enum: AppTypeMainSettingsAdmin,
  })
  @IsEnum(AppTypeMainSettingsAdmin)
  app_type: AppTypeMainSettingsAdmin;

  @ApiProperty()
  @IsEmail()
  contact_email: string;

  @ApiPropertyOptional({ type: [StringLanguage] })
  @IsArray()
  @IsOptional()
  site_description?: StringLanguage[];

  @ApiProperty()
  @IsString()
  site_name: string;

  @ApiProperty()
  @IsString()
  site_short_name: string;
}
