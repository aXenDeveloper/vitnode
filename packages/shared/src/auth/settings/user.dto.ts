import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

export class UploadAvatarUserSettingsAuthBody {
  @ApiPropertyOptional({ type: 'string', format: 'binary' })
  avatar?: Express.Multer.File;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => !!value)
  delete_avatar: boolean;
}
