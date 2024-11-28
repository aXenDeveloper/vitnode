import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsOptional, IsString } from 'class-validator';

import { StringLanguage } from '../../string-language.dto';

export class CreateLegalSettingsAdminBody {
  @ApiProperty()
  @IsString()
  code: string;

  @ApiProperty({ type: [StringLanguage] })
  @ArrayMinSize(1)
  @IsArray()
  content: StringLanguage[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  href?: string;

  @ApiProperty({ type: [StringLanguage] })
  @ArrayMinSize(1)
  @IsArray()
  title: StringLanguage[];
}
