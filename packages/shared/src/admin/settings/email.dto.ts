import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class EditEmailSettingsAdminBody {
  @ApiProperty({ example: 'hsl(220, 74%, 50%)' })
  @IsString()
  color_primary: string;

  @ApiPropertyOptional({ type: 'string', format: 'binary' })
  logo?: Express.Multer.File;
}

export class ShowEmailSettingsAdminObj {
  @ApiProperty()
  color_primary: string;

  @ApiProperty()
  is_enabled: boolean;
}
