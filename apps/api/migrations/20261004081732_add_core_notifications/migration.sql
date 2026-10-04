CREATE TABLE "core_notification_deliveries" (
	"id" bigserial PRIMARY KEY,
	"userId" integer NOT NULL,
	"channel" varchar(20) NOT NULL,
	"mode" varchar(20) NOT NULL,
	"eventId" bigint,
	"idempotencyKey" varchar(255) NOT NULL UNIQUE,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"maxAttempts" integer DEFAULT 5 NOT NULL,
	"availableAt" timestamp DEFAULT now() NOT NULL,
	"periodStart" timestamp,
	"periodEnd" timestamp,
	"itemCount" integer DEFAULT 0 NOT NULL,
	"providerMessageId" varchar(255),
	"lastError" varchar(500),
	"skipReason" varchar(50),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"sentAt" timestamp
);
--> statement-breakpoint
ALTER TABLE "core_notification_deliveries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_notification_events" (
	"id" bigserial PRIMARY KEY,
	"pluginId" varchar(100) NOT NULL,
	"type" varchar(100) NOT NULL,
	"schemaVersion" integer DEFAULT 1 NOT NULL,
	"idempotencyKey" varchar(255) NOT NULL,
	"actorId" integer,
	"subjectType" varchar(100),
	"subjectId" varchar(100),
	"groupKey" varchar(255),
	"data" jsonb DEFAULT '{}' NOT NULL,
	"recipientIds" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"followersOf" jsonb DEFAULT '[]' NOT NULL,
	"allowSelf" boolean DEFAULT false NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"recipientCursor" integer DEFAULT 0 NOT NULL,
	"followerSubjectCursor" integer DEFAULT 0 NOT NULL,
	"followerUserCursor" integer DEFAULT 0 NOT NULL,
	"deliveredCount" integer DEFAULT 0 NOT NULL,
	"lastError" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"completedAt" timestamp
);
--> statement-breakpoint
ALTER TABLE "core_notification_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_notification_receipts" (
	"eventId" bigint,
	"userId" integer,
	"notificationId" bigint,
	"seq" integer,
	"emailPending" boolean DEFAULT false NOT NULL,
	"emailDeliveryId" bigint,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "core_notification_receipts_pkey" PRIMARY KEY("eventId","userId")
);
--> statement-breakpoint
ALTER TABLE "core_notification_receipts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_notification_settings" (
	"key" varchar(255) PRIMARY KEY,
	"value" jsonb DEFAULT '{}' NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_notification_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_notification_subscriptions" (
	"userId" integer,
	"subjectType" varchar(100),
	"subjectId" varchar(100),
	"state" varchar(20) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "core_notification_subscriptions_pkey" PRIMARY KEY("userId","subjectType","subjectId")
);
--> statement-breakpoint
ALTER TABLE "core_notification_subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_notification_user_state" (
	"userId" integer PRIMARY KEY,
	"unreadCount" integer DEFAULT 0 NOT NULL,
	"revision" bigint DEFAULT 0 NOT NULL,
	"timeZone" varchar(64),
	"digestHour" smallint DEFAULT 8 NOT NULL,
	"digestWeekday" smallint DEFAULT 1 NOT NULL,
	"preferences" jsonb DEFAULT '{}' NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_notification_user_state" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_notifications" (
	"id" bigserial PRIMARY KEY,
	"userId" integer NOT NULL,
	"pluginId" varchar(100) NOT NULL,
	"type" varchar(100) NOT NULL,
	"category" varchar(50) NOT NULL,
	"groupKey" varchar(255) NOT NULL,
	"groupBucket" bigint DEFAULT 0 NOT NULL,
	"subjectType" varchar(100),
	"subjectId" varchar(100),
	"latestEventId" bigint NOT NULL,
	"eventCount" integer DEFAULT 1 NOT NULL,
	"activitySeq" integer DEFAULT 1 NOT NULL,
	"readSeq" integer DEFAULT 0 NOT NULL,
	"readAt" timestamp,
	"archivedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"lastActivityAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "core_notification_deliveries_claim_idx" ON "core_notification_deliveries" ("availableAt","id") WHERE status = 'pending';--> statement-breakpoint
CREATE INDEX "core_notification_deliveries_status_idx" ON "core_notification_deliveries" ("status","id");--> statement-breakpoint
CREATE INDEX "core_notification_deliveries_user_idx" ON "core_notification_deliveries" ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "core_notification_events_idempotency_unique" ON "core_notification_events" ("pluginId","type","idempotencyKey");--> statement-breakpoint
CREATE INDEX "core_notification_events_status_idx" ON "core_notification_events" ("status","id");--> statement-breakpoint
CREATE INDEX "core_notification_events_created_at_idx" ON "core_notification_events" ("createdAt");--> statement-breakpoint
CREATE INDEX "core_notification_receipts_notification_idx" ON "core_notification_receipts" ("notificationId","seq");--> statement-breakpoint
CREATE INDEX "core_notification_receipts_user_idx" ON "core_notification_receipts" ("userId");--> statement-breakpoint
CREATE INDEX "core_notification_receipts_email_pending_idx" ON "core_notification_receipts" ("userId","createdAt") WHERE "emailPending" = true AND "emailDeliveryId" IS NULL;--> statement-breakpoint
CREATE INDEX "core_notification_subscriptions_subject_idx" ON "core_notification_subscriptions" ("subjectType","subjectId","state","userId");--> statement-breakpoint
CREATE INDEX "core_notification_user_state_unread_idx" ON "core_notification_user_state" ("unreadCount");--> statement-breakpoint
CREATE UNIQUE INDEX "core_notifications_group_unique" ON "core_notifications" ("userId","pluginId","type","groupKey","groupBucket");--> statement-breakpoint
CREATE INDEX "core_notifications_inbox_idx" ON "core_notifications" ("userId","lastActivityAt" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "archivedAt" IS NULL;--> statement-breakpoint
CREATE INDEX "core_notifications_unread_idx" ON "core_notifications" ("userId","lastActivityAt" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "archivedAt" IS NULL AND "readSeq" < "activitySeq";--> statement-breakpoint
CREATE INDEX "core_notifications_subject_idx" ON "core_notifications" ("subjectType","subjectId");--> statement-breakpoint
CREATE INDEX "core_notifications_last_activity_idx" ON "core_notifications" ("lastActivityAt");--> statement-breakpoint
CREATE INDEX "core_notifications_latest_event_idx" ON "core_notifications" ("latestEventId");--> statement-breakpoint
ALTER TABLE "core_notification_deliveries" ADD CONSTRAINT "core_notification_deliveries_userId_core_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "core_users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_notification_deliveries" ADD CONSTRAINT "core_notification_deliveries_vcf37BytIa0M_fkey" FOREIGN KEY ("eventId") REFERENCES "core_notification_events"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "core_notification_events" ADD CONSTRAINT "core_notification_events_actorId_core_users_id_fkey" FOREIGN KEY ("actorId") REFERENCES "core_users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "core_notification_receipts" ADD CONSTRAINT "core_notification_receipts_UQ7ZEs0I6ijx_fkey" FOREIGN KEY ("eventId") REFERENCES "core_notification_events"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_notification_receipts" ADD CONSTRAINT "core_notification_receipts_userId_core_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "core_users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_notification_receipts" ADD CONSTRAINT "core_notification_receipts_Vxye2Cs6MgcL_fkey" FOREIGN KEY ("notificationId") REFERENCES "core_notifications"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_notification_subscriptions" ADD CONSTRAINT "core_notification_subscriptions_userId_core_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "core_users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_notification_user_state" ADD CONSTRAINT "core_notification_user_state_userId_core_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "core_users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_notifications" ADD CONSTRAINT "core_notifications_userId_core_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "core_users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_notifications" ADD CONSTRAINT "core_notifications_I8QoGbTal5Wt_fkey" FOREIGN KEY ("latestEventId") REFERENCES "core_notification_events"("id") ON DELETE RESTRICT;