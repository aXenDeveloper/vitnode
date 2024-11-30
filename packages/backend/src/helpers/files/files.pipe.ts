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
        maxCount: number;
        maxSize: number;
      }
    >,
  ) {}

  private validateFieldExists(file: Express.Multer.File): void {
    if (!this.options[file.fieldname]) {
      throw new InternalServerErrorException(
        `Invalid file field ${file.fieldname} in FilesValidationPipe`,
      );
    }
  }

  private validateFileCount(
    files: Express.Multer.File[],
    file: Express.Multer.File,
  ): void {
    const { maxCount } = this.options[file.fieldname];
    const fieldCount = files.filter(f => f.fieldname === file.fieldname).length;

    if (maxCount && fieldCount > maxCount) {
      throw new BadRequestException(
        `Exceeded maximum file count of ${maxCount} for ${file.fieldname} field`,
      );
    }
  }

  private validateFileSize(file: Express.Multer.File): void {
    const { maxSize } = this.options[file.fieldname];

    if (file.size > maxSize) {
      throw new BadRequestException(
        `File ${file.originalname} (${file.size} bytes) exceeds size limit of ${maxSize} bytes for ${file.fieldname} field`,
      );
    }
  }

  private validateFileType(file: Express.Multer.File): void {
    const { acceptMimeType } = this.options[file.fieldname];

    if (acceptMimeType.length && !acceptMimeType.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type for ${file.originalname} (${file.mimetype})`,
      );
    }
  }

  private validateInput(
    filesFromArgs:
      | Express.Multer.File
      | Express.Multer.File[]
      | Record<string, Express.Multer.File | Express.Multer.File[]>,
  ): Express.Multer.File[] {
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

    return files;
  }

  transform(
    filesFromArgs:
      | Express.Multer.File
      | Express.Multer.File[]
      | Record<string, Express.Multer.File | Express.Multer.File[]>,
  ): Record<string, Express.Multer.File | Express.Multer.File[]> {
    const files = this.validateInput(filesFromArgs);

    // Validate files
    files.forEach(file => {
      this.validateFieldExists(file);
      this.validateFileCount(files, file);
      this.validateFileType(file);
      this.validateFileSize(file);
    });

    const groupByFieldName: Record<
      string,
      Express.Multer.File | Express.Multer.File[]
    > = files.reduce((acc, file) => {
      if (!acc[file.fieldname]) {
        acc[file.fieldname] =
          this.options[file.fieldname].maxCount === 1 ? undefined : [];
      }
      if (this.options[file.fieldname].maxCount === 1) {
        acc[file.fieldname] = file;
      } else {
        (acc[file.fieldname] as Express.Multer.File[]).push(file);
      }

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
