import { Module } from "@nestjs/common";

import { ForumsForumModule } from "./forums/forums.module";
import { TopicsForumModule } from "./topics/topics.module";
import { PostsForumModule } from "./posts/posts.module";
import { AdminForumModule } from "./admin/admin.module";

@Module({
  imports: [
    AdminForumModule,
    ForumsForumModule,
    TopicsForumModule,
    PostsForumModule
  ]
})
export class ForumModule {}
