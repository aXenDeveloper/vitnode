import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class EditorStylesAdminBody {
  @ApiProperty()
  @IsBoolean()
  sticky: boolean;
}
