import { applyDecorators, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiConsumes } from '@nestjs/swagger';

export function UploadFilesMethod({ fields }: { fields: string[] }) {
  const decorators: ClassDecorator[] = [
    ApiConsumes('multipart/form-data'),
    UseInterceptors(
      FileFieldsInterceptor(fields.map(field => ({ name: field }))),
    ),
  ];

  return applyDecorators(...decorators);
}
