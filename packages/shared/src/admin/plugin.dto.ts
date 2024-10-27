import { TransformString } from '@/utils/text-language';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { ItemNavAuthAdminObj } from './auth.dto';

export class CreatePluginsAdminBody {
  @Transform(TransformString)
  @MinLength(3)
  @MaxLength(100)
  @ApiProperty()
  author: string;

  @Transform(TransformString)
  @IsOptional()
  @ApiPropertyOptional()
  author_url?: string;

  @Transform(TransformString)
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-z0-9-]*$/)
  @ApiProperty()
  code: string;

  @Transform(TransformString)
  @MaxLength(255)
  @IsOptional()
  @ApiPropertyOptional()
  description?: string;

  @Transform(TransformString)
  @ApiProperty()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @Transform(TransformString)
  @IsNotEmpty()
  @ApiProperty()
  support_url: string;
}

export interface NavPluginInfoJSONType extends ItemNavAuthAdminObj {
  children?: ItemNavAuthAdminObj[];
  parent_code?: string;
}

export interface ConfigPlugin extends CreatePluginsAdminBody {
  allow_default: boolean;
  nav: NavPluginInfoJSONType[];
  permissions_admin?: {
    id: string;
    permissions: string[];
  }[];
  version: string;
  version_code: number;
}
