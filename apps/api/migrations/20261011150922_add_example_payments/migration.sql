CREATE TABLE "example_payments_access" (
	"id" serial PRIMARY KEY,
	"userId" integer NOT NULL,
	"offerId" varchar(64) NOT NULL,
	"purchaseId" uuid NOT NULL,
	"accessUntil" timestamp,
	"revokedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "example_payments_access" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "example_payments_access_user_offer_unique" ON "example_payments_access" ("userId","offerId");--> statement-breakpoint
ALTER TABLE "example_payments_access" ADD CONSTRAINT "example_payments_access_userId_core_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "core_users"("id") ON DELETE CASCADE;