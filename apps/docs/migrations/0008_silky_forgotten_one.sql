CREATE TABLE "core_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"key" varchar(512) NOT NULL,
	"folder" varchar(255) NOT NULL,
	"mimeType" varchar(255),
	"size" integer DEFAULT 0 NOT NULL,
	"userId" integer,
	"pluginId" varchar(100),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "core_files_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "core_files" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "core_files" ADD CONSTRAINT "core_files_userId_core_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."core_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "core_files_user_id_idx" ON "core_files" USING btree ("userId");