import { ArgsType, Field, Int } from "@nestjs/graphql";

@ArgsType()
export class ShowCoreThemesArgs {
  @Field(() => Int, { nullable: true })
  cursor: number | null;

  @Field(() => Int, { nullable: true })
  first: number | null;

  @Field(() => Int, { nullable: true })
  last: number | null;
}
