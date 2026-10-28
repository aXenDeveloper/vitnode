CREATE TABLE "core_payments" (
	"id" uuid PRIMARY KEY,
	"pluginId" varchar(100) NOT NULL,
	"reference" varchar(255) NOT NULL,
	"userId" integer,
	"providerId" varchar(100) NOT NULL,
	"providerType" varchar(50) NOT NULL,
	"amount" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"description" varchar(255) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"providerStatus" varchar(50),
	"checkoutId" varchar(255),
	"checkoutUrl" text,
	"livemode" boolean,
	"errorCode" varchar(64),
	"expiresAt" timestamp NOT NULL,
	"syncedAt" timestamp,
	"completedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "core_payments_amount_positive" CHECK ("amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "core_payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_payments_webhook_events" (
	"providerId" varchar(100),
	"eventId" varchar(255),
	"type" varchar(100) NOT NULL,
	"paymentId" uuid,
	"receivedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "core_payments_webhook_events_pkey" PRIMARY KEY("providerId","eventId")
);
--> statement-breakpoint
ALTER TABLE "core_payments_webhook_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payments_demo_purchases" (
	"id" serial PRIMARY KEY,
	"userId" integer NOT NULL,
	"itemId" varchar(50) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payments_demo_purchases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "core_payments_open_reference_unique" ON "core_payments" ("pluginId","reference") WHERE status IN ('pending', 'processing');--> statement-breakpoint
CREATE UNIQUE INDEX "core_payments_checkout_unique" ON "core_payments" ("providerId","checkoutId") WHERE "checkoutId" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "core_payments_reference_idx" ON "core_payments" ("pluginId","reference");--> statement-breakpoint
CREATE INDEX "core_payments_user_id_idx" ON "core_payments" ("userId");--> statement-breakpoint
CREATE INDEX "core_payments_open_updated_at_idx" ON "core_payments" ("updatedAt") WHERE status IN ('pending', 'processing');--> statement-breakpoint
CREATE INDEX "core_payments_webhook_events_received_at_idx" ON "core_payments_webhook_events" ("receivedAt");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_demo_purchases_user_item_unique" ON "payments_demo_purchases" ("userId","itemId");--> statement-breakpoint
ALTER TABLE "core_payments" ADD CONSTRAINT "core_payments_userId_core_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "core_users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "core_payments_webhook_events" ADD CONSTRAINT "core_payments_webhook_events_paymentId_core_payments_id_fkey" FOREIGN KEY ("paymentId") REFERENCES "core_payments"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "payments_demo_purchases" ADD CONSTRAINT "payments_demo_purchases_userId_core_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "core_users"("id") ON DELETE CASCADE;