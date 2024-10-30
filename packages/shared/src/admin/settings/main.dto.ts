import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEmail, IsOptional, IsString } from 'class-validator';

import { StringLanguage } from '../../string-language.dto';

export class MainSettingsAdminBody {
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
