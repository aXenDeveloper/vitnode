import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString } from 'class-validator';

import { FileObj } from '../../utils/files.dto';

export class EditEmailSettingsAdminBody {
  @ApiProperty({ example: 'hsl(220, 74%, 50%)' })
  @IsString()
  color_primary: string;

  @ApiProperty({ example: 'hsl(210, 40%, 98%)' })
  @IsString()
  color_primary_foreground: string;

  @ApiPropertyOptional({ example: false })
  delete_logo?: boolean;

  @ApiPropertyOptional({ type: 'string', format: 'binary' })
  logo?: Express.Multer.File;
}

export class ShowEmailSettingsAdminObj {
  @ApiProperty()
  color_primary: string;

  @ApiProperty()
  is_enabled: boolean;

  @ApiPropertyOptional()
  logo?: FileObj;
}
