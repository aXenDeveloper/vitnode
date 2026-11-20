CREATE SEQUENCE "public"."core_reactions_counts_version_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "core_reactions" (
	"id" serial PRIMARY KEY,
	"code" varchar(32) NOT NULL UNIQUE,
	"kind" varchar(10) NOT NULL,
	"icon" varchar(100),
	"fileId" integer,
	"posterFileId" integer,
	"points" integer DEFAULT 0 NOT NULL,
	"allRoles" boolean DEFAULT true NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_reactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_reactions_counts" (
	"pluginId" varchar(100),
	"targetType" varchar(100),
	"targetId" varchar(64),
	"reactionId" integer,
	"count" integer DEFAULT 0 NOT NULL,
	"version" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "core_reactions_counts_pkey" PRIMARY KEY("pluginId","targetType","targetId","reactionId")
);
--> statement-breakpoint
ALTER TABLE "core_reactions_counts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_reactions_entries" (
	"id" serial PRIMARY KEY,
	"pluginId" varchar(100) NOT NULL,
	"targetType" varchar(100) NOT NULL,
	"targetId" varchar(64) NOT NULL,
	"reactionId" integer NOT NULL,
	"userId" integer NOT NULL,
	"targetAuthorId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "core_reactions_entries_unique" UNIQUE("pluginId","targetType","targetId","userId","reactionId")
);
--> statement-breakpoint
ALTER TABLE "core_reactions_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_reactions_roles" (
	"reactionId" integer,
	"roleId" integer,
	"dailyLimit" integer,
	CONSTRAINT "core_reactions_roles_pkey" PRIMARY KEY("reactionId","roleId")
);
--> statement-breakpoint
ALTER TABLE "core_reactions_roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "core_roles" ADD COLUMN "allowReact" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "core_roles" ADD COLUMN "maxReactionsPerItem" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "core_roles" ADD COLUMN "reactionsPerDay" integer;--> statement-breakpoint
ALTER TABLE "core_users" ADD COLUMN "reputation" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "core_users" ADD COLUMN "showReactionsOnProfile" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX "core_reactions_position_idx" ON "core_reactions" ("position","id");--> statement-breakpoint
CREATE INDEX "core_reactions_counts_reaction_idx" ON "core_reactions_counts" ("reactionId");--> statement-breakpoint
CREATE INDEX "core_reactions_entries_user_timeline_idx" ON "core_reactions_entries" ("userId","createdAt","id");--> statement-breakpoint
CREATE INDEX "core_reactions_entries_user_reaction_idx" ON "core_reactions_entries" ("userId","reactionId","createdAt");--> statement-breakpoint
CREATE INDEX "core_reactions_entries_target_idx" ON "core_reactions_entries" ("pluginId","targetType","targetId","reactionId","createdAt");--> statement-breakpoint
CREATE INDEX "core_reactions_entries_author_idx" ON "core_reactions_entries" ("targetAuthorId","reactionId");--> statement-breakpoint
CREATE INDEX "core_reactions_entries_reaction_idx" ON "core_reactions_entries" ("reactionId");--> statement-breakpoint
CREATE INDEX "core_reactions_roles_role_id_idx" ON "core_reactions_roles" ("roleId");--> statement-breakpoint
CREATE INDEX "core_users_reputation_idx" ON "core_users" ("reputation");--> statement-breakpoint
ALTER TABLE "core_reactions" ADD CONSTRAINT "core_reactions_fileId_core_files_id_fkey" FOREIGN KEY ("fileId") REFERENCES "core_files"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "core_reactions" ADD CONSTRAINT "core_reactions_posterFileId_core_files_id_fkey" FOREIGN KEY ("posterFileId") REFERENCES "core_files"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "core_reactions_counts" ADD CONSTRAINT "core_reactions_counts_reactionId_core_reactions_id_fkey" FOREIGN KEY ("reactionId") REFERENCES "core_reactions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_reactions_entries" ADD CONSTRAINT "core_reactions_entries_reactionId_core_reactions_id_fkey" FOREIGN KEY ("reactionId") REFERENCES "core_reactions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_reactions_entries" ADD CONSTRAINT "core_reactions_entries_userId_core_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "core_users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_reactions_entries" ADD CONSTRAINT "core_reactions_entries_targetAuthorId_core_users_id_fkey" FOREIGN KEY ("targetAuthorId") REFERENCES "core_users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "core_reactions_roles" ADD CONSTRAINT "core_reactions_roles_reactionId_core_reactions_id_fkey" FOREIGN KEY ("reactionId") REFERENCES "core_reactions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_reactions_roles" ADD CONSTRAINT "core_reactions_roles_roleId_core_roles_id_fkey" FOREIGN KEY ("roleId") REFERENCES "core_roles"("id") ON DELETE CASCADE;--> statement-breakpoint
UPDATE "core_roles" SET "allowReact" = false WHERE "guest" = true;