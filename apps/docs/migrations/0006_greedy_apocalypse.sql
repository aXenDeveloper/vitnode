CREATE TABLE "core_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"pluginId" varchar(100) NOT NULL,
	"name" varchar(100) NOT NULL,
	"queue" varchar(100) DEFAULT 'default' NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"maxAttempts" integer DEFAULT 3 NOT NULL,
	"availableAt" timestamp DEFAULT now() NOT NULL,
	"reservedAt" timestamp,
	"lastError" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp NOT NULL,
	"completedAt" timestamp
);
--> statement-breakpoint
ALTER TABLE "core_queue" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "core_queue_status_available_at_idx" ON "core_queue" USING btree ("status","availableAt");