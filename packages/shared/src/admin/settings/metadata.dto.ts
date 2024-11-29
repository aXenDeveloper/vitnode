import { ApiProperty, OmitType } from '@nestjs/swagger';
import { IsEnum, IsString } from 'class-validator';

import { ManifestDisplay } from './metadata.enum';

export class ShowMetadataAdminObj {
  @ApiProperty({ example: '#09090b' })
  @IsString()
  background_color: string;

  @ApiProperty({ example: 'standalone', enum: ManifestDisplay })
  @IsEnum(ManifestDisplay)
  display: ManifestDisplay;

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
]) {}
