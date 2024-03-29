import { ArgsType, Field } from "@nestjs/graphql";

import { GraphQLUpload } from "@/utils/graphql-upload/GraphQLUpload";
import { FileUpload } from "@/utils/graphql-upload/Upload";

@ArgsType()
export class UploadAdminPluginsArgs {
  @Field(() => GraphQLUpload)
  file: Promise<FileUpload>;

  @Field(() => String, { nullable: true })
  code: string | null;
}
