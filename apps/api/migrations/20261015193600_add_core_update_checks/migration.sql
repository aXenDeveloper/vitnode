CREATE TABLE "core_update_lock" (
	"name" varchar(50) PRIMARY KEY,
	"owner" varchar(64),
	"expiresAt" timestamp,
	"lastManualAt" timestamp
);
--> statement-breakpoint
ALTER TABLE "core_update_lock" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_update_results" (
	"componentId" varchar(214) PRIMARY KEY,
	"sourceUrl" varchar(2048) NOT NULL,
	"channel" varchar(20),
	"versions" jsonb NOT NULL,
	"hasUnknownVersion" boolean DEFAULT false NOT NULL,
	"coreVersion" varchar(256),
	"result" jsonb,
	"lastAttemptAt" timestamp NOT NULL,
	"lastSuccessAt" timestamp,
	"lastError" jsonb
);
--> statement-breakpoint
ALTER TABLE "core_update_results" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_update_sources" (
	"url" varchar(2048) PRIMARY KEY,
	"etag" varchar(512),
	"lastModified" varchar(128),
	"document" jsonb,
	"lastAttemptAt" timestamp NOT NULL,
	"lastSuccessAt" timestamp,
	"lastError" jsonb
);
--> statement-breakpoint
ALTER TABLE "core_update_sources" ENABLE ROW LEVEL SECURITY;