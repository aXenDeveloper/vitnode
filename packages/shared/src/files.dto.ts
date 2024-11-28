import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

import { FileObj } from './utils/files.dto';

export class DeleteFilesQuery {
  @ApiProperty()
  @IsString()
  file_id: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  security_key?: string;
}

export class ShowFile extends FileObj {
  @ApiProperty()
  count_uses: number;

  @ApiProperty()
  created_at: Date;

  @ApiPropertyOptional()
  file_alt: null | string;

  @ApiProperty()
  id: number;

  @ApiPropertyOptional()
  security_key: null | string;
}

export class UploadFilesBody {
  @ApiProperty({ type: 'string', format: 'binary' })
  file: Express.Multer.File;

  @ApiProperty()
  @IsString()
  folder: string;

  @ApiProperty()
  @IsString()
  plugin_code: string;
}
