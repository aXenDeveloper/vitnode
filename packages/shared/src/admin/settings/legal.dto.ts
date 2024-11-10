import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsOptional, IsString } from 'class-validator';

import { StringLanguage } from '../../string-language.dto';

export class CreateLegalSettingsAdminBody {
  @ApiProperty()
  @IsString()
  code: string;

  @ApiProperty({ type: [StringLanguage] })
  @IsArray()
  @ArrayMinSize(1)
  content: StringLanguage[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  href?: string;

  @ApiProperty({ type: [StringLanguage] })
  @IsArray()
  @ArrayMinSize(1)
  title: StringLanguage[];
}
