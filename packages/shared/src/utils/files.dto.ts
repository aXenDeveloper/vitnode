import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FileObj {
  @ApiProperty()
  dir_folder: string;

  @ApiProperty()
  extension: string;

  @ApiProperty()
  file_name: string;

  @ApiProperty()
  file_name_original: string;

  @ApiProperty()
  file_size: number;

  @ApiPropertyOptional()
  height: null | number;

  @ApiProperty()
  mimetype: string;

  @ApiProperty()
  secure: boolean;

  @ApiPropertyOptional()
  width: null | number;
}
