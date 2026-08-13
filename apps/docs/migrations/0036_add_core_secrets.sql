CREATE TABLE "core_secrets" (
	"name" varchar(100) PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_secrets" ENABLE ROW LEVEL SECURITY;