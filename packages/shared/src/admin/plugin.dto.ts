import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { TransformString } from '../utils/text-language';

export interface ConfigPlugin extends CreatePluginsAdminBody {
  nav?: {
    children?: {
      code: string;
      icon?: string;
      keywords?: string[];
    }[];
    code: string;
    icon?: string;
    keywords?: string[];
  }[];
  permissions_admin?: {
    id: string;
    permissions?: string[];
  }[];
  version: string;
  version_code: number;
}

export class CreatePluginsAdminBody {
  @ApiProperty()
  @MaxLength(100)
  @MinLength(3)
  @Transform(TransformString)
  author: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(TransformString)
  author_url?: string;

  @ApiProperty()
  @Matches(/^[a-z0-9-]*$/)
  @MaxLength(50)
  @MinLength(3)
  @Transform(TransformString)
  code: string;

  @ApiPropertyOptional()
  @IsOptional()
  @MaxLength(255)
  @Transform(TransformString)
  description?: string;

  @ApiProperty()
  @MaxLength(100)
  @MinLength(3)
  @Transform(TransformString)
  name: string;

  @ApiProperty()
  @IsNotEmpty()
  @Transform(TransformString)
  support_url: string;
}

export class EditPluginsAdminBody extends OmitType(CreatePluginsAdminBody, [
  'code',
] as const) {
  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  default?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}
