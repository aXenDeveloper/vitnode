import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  PipeTransform,
} from '@nestjs/common';

@Injectable()
export class FilesValidationPipe implements PipeTransform {
  constructor(
    private readonly options: Record<
      string,
      {
        acceptMimeType: string[];
        isOptional?: boolean;
        maxSize: number;
      }
    >,
  ) {}

  transform(
    filesFromArgs:
      | Express.Multer.File
      | Express.Multer.File[]
      | Record<string, Express.Multer.File | Express.Multer.File[]>,
  ): Record<string, Express.Multer.File[]> {
    const checkIfIsRecord = !!(
      Array.isArray(filesFromArgs) ? filesFromArgs : [filesFromArgs]
    ).at(0)?.fieldname;
    if (checkIfIsRecord) {
      throw new BadRequestException('Invalid file format');
    }
    if (!filesFromArgs) {
      throw new BadRequestException('No files uploaded');
    }

    const files: Express.Multer.File[] = Object.keys(filesFromArgs)
      .map(key => filesFromArgs[key])
      .flatMap(files => files);

    // Validate files
    files.forEach(file => {
      if (!this.options[file.fieldname]) {
        throw new InternalServerErrorException(
          `Invalid file field ${file.fieldname} in FilesValidationPipe`,
        );
      }

      // Validate file size
      if (file.size > this.options[file.fieldname].maxSize) {
        throw new BadRequestException(
          `File ${file.originalname} (${file.size} bytes) exceeds size limit of ${this.options[file.fieldname].maxSize} bytes for ${file.fieldname} field`,
        );
      }

      // Validate file type
      if (
        this.options[file.fieldname].acceptMimeType.length &&
        !this.options[file.fieldname].acceptMimeType.includes(file.mimetype)
      ) {
        throw new BadRequestException(
          `Invalid file type for ${file.originalname} (${file.mimetype})`,
        );
      }
    });

    const groupByFieldName: Record<string, Express.Multer.File[]> =
      files.reduce((acc, file) => {
        if (!acc[file.fieldname]) {
          acc[file.fieldname] = [];
        }
        acc[file.fieldname].push(file);

        return acc;
      }, {});

    // Validate if required fields are present
    Object.keys(this.options).forEach(fieldName => {
      if (!this.options[fieldName].isOptional && !groupByFieldName[fieldName]) {
        throw new BadRequestException(`Field ${fieldName} is required`);
      }
    });

    return groupByFieldName;
  }
}
