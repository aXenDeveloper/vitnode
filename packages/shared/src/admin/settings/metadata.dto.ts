import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

import { FileObj } from '../../utils/files.dto';
import { ManifestDisplay } from './metadata.enum';

export class ShowMetadataAdminObj {
  @ApiProperty({ example: '#09090b' })
  @IsString()
  background_color: string;

  @ApiProperty({ example: 'standalone', enum: ManifestDisplay })
  @IsEnum(ManifestDisplay)
  display: ManifestDisplay;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  icon?: FileObj;

  @ApiProperty({ example: '/' })
  @IsString()
  id: string;

  @ApiProperty({ example: 'en' })
  @IsString()
  lang: string;

  @ApiProperty({ example: '/' })
  @IsString()
  start_url: string;

  @ApiProperty({ example: '#2463eb' })
  @IsString()
  theme_color: string;
}

export class ShowMetadataAdminBody extends OmitType(ShowMetadataAdminObj, [
  'id',
  'lang',
  'icon',
]) {
  @ApiPropertyOptional({ type: 'string', format: 'binary' })
  icon?: Express.Multer.File;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  remove_icon?: boolean;
}
