CREATE TABLE "core_content_schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"pluginId" varchar(255) NOT NULL,
	"contentTypeId" varchar(100) NOT NULL,
	"itemId" integer NOT NULL,
	"action" varchar(16) NOT NULL,
	"scheduledFor" timestamp NOT NULL,
	"generation" integer DEFAULT 1 NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"createdBy" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"completedAt" timestamp,
	"lastError" text
);
--> statement-breakpoint
ALTER TABLE "core_content_schedules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "core_content_schedules" ADD CONSTRAINT "core_content_schedules_createdBy_core_users_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."core_users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "core_content_schedules_active_unique" ON "core_content_schedules" USING btree ("contentTypeId","itemId","action") WHERE status = 'pending';--> statement-breakpoint
CREATE INDEX "core_content_schedules_due_idx" ON "core_content_schedules" USING btree ("status","scheduledFor");--> statement-breakpoint
CREATE INDEX "core_content_schedules_item_idx" ON "core_content_schedules" USING btree ("contentTypeId","itemId");--> statement-breakpoint
CREATE INDEX "core_content_schedules_plugin_id_idx" ON "core_content_schedules" USING btree ("pluginId");--> statement-breakpoint
CREATE INDEX "core_content_schedules_created_by_idx" ON "core_content_schedules" USING btree ("createdBy");