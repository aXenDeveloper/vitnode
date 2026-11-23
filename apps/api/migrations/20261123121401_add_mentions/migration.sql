CREATE TABLE "core_mentions" (
	"id" serial PRIMARY KEY,
	"pluginId" varchar(100) NOT NULL,
	"targetType" varchar(100) NOT NULL,
	"targetId" varchar(100) NOT NULL,
	"userId" integer NOT NULL,
	"actorId" integer,
	"eventId" bigint,
	"notified" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_mentions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "core_roles" ADD COLUMN "allowMentions" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "core_roles" ADD COLUMN "maxMentionsPerItem" integer DEFAULT 25;--> statement-breakpoint
UPDATE "core_roles" SET "allowMentions" = false WHERE "guest" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "core_mentions_target_user_idx" ON "core_mentions" ("pluginId","targetType","targetId","userId");--> statement-breakpoint
CREATE INDEX "core_mentions_user_id_idx" ON "core_mentions" ("userId","createdAt");--> statement-breakpoint
CREATE INDEX "core_mentions_event_id_idx" ON "core_mentions" ("eventId");--> statement-breakpoint
ALTER TABLE "core_mentions" ADD CONSTRAINT "core_mentions_userId_core_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "core_users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_mentions" ADD CONSTRAINT "core_mentions_actorId_core_users_id_fkey" FOREIGN KEY ("actorId") REFERENCES "core_users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "core_mentions" ADD CONSTRAINT "core_mentions_eventId_core_notification_events_id_fkey" FOREIGN KEY ("eventId") REFERENCES "core_notification_events"("id") ON DELETE SET NULL;