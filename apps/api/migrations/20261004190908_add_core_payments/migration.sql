CREATE TABLE "core_payments_adjustments" (
	"id" serial PRIMARY KEY,
	"kind" varchar(10) NOT NULL,
	"provider" varchar(32) NOT NULL,
	"providerScope" varchar(32) NOT NULL,
	"externalId" varchar(255) NOT NULL,
	"purchaseId" integer,
	"invoiceId" integer,
	"amount" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"status" varchar(30) NOT NULL,
	"reason" varchar(100),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_payments_adjustments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_payments_checkouts" (
	"id" serial PRIMARY KEY,
	"purchaseId" integer NOT NULL,
	"provider" varchar(32) NOT NULL,
	"providerScope" varchar(32) NOT NULL,
	"externalId" varchar(255),
	"url" text,
	"status" varchar(20) DEFAULT 'creating' NOT NULL,
	"idempotencyKey" varchar(100) NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"lastError" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_payments_checkouts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_payments_customers" (
	"id" serial PRIMARY KEY,
	"userId" integer NOT NULL,
	"provider" varchar(32) NOT NULL,
	"providerScope" varchar(32) NOT NULL,
	"externalId" varchar(255) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_payments_customers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_payments_fulfillments" (
	"id" serial PRIMARY KEY,
	"purchaseId" integer NOT NULL,
	"effect" varchar(100) NOT NULL,
	"payload" jsonb DEFAULT '{}' NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"generation" integer DEFAULT 1 NOT NULL,
	"completedGeneration" integer DEFAULT 0 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"lastError" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"completedAt" timestamp
);
--> statement-breakpoint
ALTER TABLE "core_payments_fulfillments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_payments_invoices" (
	"id" serial PRIMARY KEY,
	"subscriptionId" integer NOT NULL,
	"provider" varchar(32) NOT NULL,
	"providerScope" varchar(32) NOT NULL,
	"externalId" varchar(255) NOT NULL,
	"externalPaymentId" varchar(255),
	"status" varchar(20) NOT NULL,
	"providerStatus" varchar(50) NOT NULL,
	"billingReason" varchar(50),
	"amountDue" bigint NOT NULL,
	"amountPaid" bigint DEFAULT 0 NOT NULL,
	"currency" varchar(3) NOT NULL,
	"periodStart" timestamp,
	"periodEnd" timestamp,
	"paidAt" timestamp,
	"refundStatus" varchar(10) DEFAULT 'none' NOT NULL,
	"refundedAmount" bigint DEFAULT 0 NOT NULL,
	"disputeStatus" varchar(10),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_payments_invoices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_payments_purchases" (
	"id" serial PRIMARY KEY,
	"publicId" uuid DEFAULT gen_random_uuid() NOT NULL,
	"userId" integer,
	"pluginId" varchar(100) NOT NULL,
	"offerId" varchar(64) NOT NULL,
	"offerName" varchar(255) NOT NULL,
	"mode" varchar(20) NOT NULL,
	"interval" varchar(10),
	"amount" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"provider" varchar(32) NOT NULL,
	"providerScope" varchar(32) NOT NULL,
	"externalCustomerId" varchar(255),
	"externalPaymentId" varchar(255),
	"paymentStatus" varchar(20) DEFAULT 'awaiting_payment' NOT NULL,
	"fulfillmentStatus" varchar(20) DEFAULT 'not_started' NOT NULL,
	"refundStatus" varchar(10) DEFAULT 'none' NOT NULL,
	"refundedAmount" bigint DEFAULT 0 NOT NULL,
	"disputeStatus" varchar(10),
	"idempotencyKey" varchar(100),
	"requestHash" varchar(64) NOT NULL,
	"lastError" text,
	"nextCheckAt" timestamp,
	"paidAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_payments_purchases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_payments_subscriptions" (
	"id" serial PRIMARY KEY,
	"publicId" uuid DEFAULT gen_random_uuid() NOT NULL,
	"userId" integer,
	"purchaseId" integer NOT NULL,
	"pluginId" varchar(100) NOT NULL,
	"offerId" varchar(64) NOT NULL,
	"offerName" varchar(255) NOT NULL,
	"interval" varchar(10) NOT NULL,
	"amount" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"provider" varchar(32) NOT NULL,
	"providerScope" varchar(32) NOT NULL,
	"externalId" varchar(255) NOT NULL,
	"externalCustomerId" varchar(255) NOT NULL,
	"externalPriceId" varchar(255),
	"status" varchar(20) NOT NULL,
	"providerStatus" varchar(50) NOT NULL,
	"paidThrough" timestamp,
	"currentPeriodEnd" timestamp,
	"cancelAtPeriodEnd" boolean DEFAULT false NOT NULL,
	"cancelAt" timestamp,
	"canceledAt" timestamp,
	"endedAt" timestamp,
	"syncedAt" timestamp DEFAULT now() NOT NULL,
	"nextCheckAt" timestamp,
	"lastError" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_payments_subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_payments_webhook_events" (
	"id" serial PRIMARY KEY,
	"provider" varchar(32) NOT NULL,
	"providerScope" varchar(32) NOT NULL,
	"externalId" varchar(255) NOT NULL,
	"type" varchar(100) NOT NULL,
	"target" jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"lastError" text,
	"receivedAt" timestamp DEFAULT now() NOT NULL,
	"processedAt" timestamp
);
--> statement-breakpoint
ALTER TABLE "core_payments_webhook_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "core_payments_adjustments_external_unique" ON "core_payments_adjustments" ("provider","providerScope","kind","externalId");--> statement-breakpoint
CREATE INDEX "core_payments_adjustments_purchase_idx" ON "core_payments_adjustments" ("purchaseId");--> statement-breakpoint
CREATE INDEX "core_payments_adjustments_invoice_idx" ON "core_payments_adjustments" ("invoiceId");--> statement-breakpoint
CREATE UNIQUE INDEX "core_payments_checkouts_idempotency_unique" ON "core_payments_checkouts" ("idempotencyKey");--> statement-breakpoint
CREATE UNIQUE INDEX "core_payments_checkouts_external_unique" ON "core_payments_checkouts" ("provider","providerScope","externalId") WHERE "externalId" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "core_payments_checkouts_purchase_idx" ON "core_payments_checkouts" ("purchaseId","id");--> statement-breakpoint
CREATE UNIQUE INDEX "core_payments_customers_user_unique" ON "core_payments_customers" ("provider","providerScope","userId");--> statement-breakpoint
CREATE UNIQUE INDEX "core_payments_customers_external_unique" ON "core_payments_customers" ("provider","providerScope","externalId");--> statement-breakpoint
CREATE UNIQUE INDEX "core_payments_fulfillments_effect_unique" ON "core_payments_fulfillments" ("purchaseId","effect");--> statement-breakpoint
CREATE INDEX "core_payments_fulfillments_status_idx" ON "core_payments_fulfillments" ("status","updatedAt");--> statement-breakpoint
CREATE UNIQUE INDEX "core_payments_invoices_external_unique" ON "core_payments_invoices" ("provider","providerScope","externalId");--> statement-breakpoint
CREATE UNIQUE INDEX "core_payments_invoices_payment_unique" ON "core_payments_invoices" ("provider","providerScope","externalPaymentId") WHERE "externalPaymentId" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "core_payments_invoices_subscription_idx" ON "core_payments_invoices" ("subscriptionId","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "core_payments_purchases_public_id_unique" ON "core_payments_purchases" ("publicId");--> statement-breakpoint
CREATE UNIQUE INDEX "core_payments_purchases_idempotency_unique" ON "core_payments_purchases" ("userId","idempotencyKey") WHERE "idempotencyKey" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "core_payments_purchases_open_unique" ON "core_payments_purchases" ("userId","pluginId","offerId") WHERE "paymentStatus" IN ('awaiting_payment', 'processing');--> statement-breakpoint
CREATE UNIQUE INDEX "core_payments_purchases_payment_unique" ON "core_payments_purchases" ("provider","providerScope","externalPaymentId") WHERE "externalPaymentId" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "core_payments_purchases_user_created_idx" ON "core_payments_purchases" ("userId","createdAt");--> statement-breakpoint
CREATE INDEX "core_payments_purchases_created_idx" ON "core_payments_purchases" ("createdAt","id");--> statement-breakpoint
CREATE INDEX "core_payments_purchases_reconcile_idx" ON "core_payments_purchases" ("nextCheckAt") WHERE "paymentStatus" IN ('awaiting_payment', 'processing');--> statement-breakpoint
CREATE UNIQUE INDEX "core_payments_subscriptions_public_id_unique" ON "core_payments_subscriptions" ("publicId");--> statement-breakpoint
CREATE UNIQUE INDEX "core_payments_subscriptions_purchase_unique" ON "core_payments_subscriptions" ("purchaseId");--> statement-breakpoint
CREATE UNIQUE INDEX "core_payments_subscriptions_external_unique" ON "core_payments_subscriptions" ("provider","providerScope","externalId");--> statement-breakpoint
CREATE INDEX "core_payments_subscriptions_user_created_idx" ON "core_payments_subscriptions" ("userId","createdAt");--> statement-breakpoint
CREATE INDEX "core_payments_subscriptions_created_idx" ON "core_payments_subscriptions" ("createdAt","id");--> statement-breakpoint
CREATE INDEX "core_payments_subscriptions_reconcile_idx" ON "core_payments_subscriptions" ("nextCheckAt") WHERE "nextCheckAt" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "core_payments_webhook_events_external_unique" ON "core_payments_webhook_events" ("provider","providerScope","externalId");--> statement-breakpoint
CREATE INDEX "core_payments_webhook_events_status_idx" ON "core_payments_webhook_events" ("status","receivedAt");--> statement-breakpoint
ALTER TABLE "core_payments_adjustments" ADD CONSTRAINT "core_payments_adjustments_EUTqqDwrKlmk_fkey" FOREIGN KEY ("purchaseId") REFERENCES "core_payments_purchases"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_payments_adjustments" ADD CONSTRAINT "core_payments_adjustments_QMnJHJ2Aqsry_fkey" FOREIGN KEY ("invoiceId") REFERENCES "core_payments_invoices"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_payments_checkouts" ADD CONSTRAINT "core_payments_checkouts_rXOG1d1T8QhR_fkey" FOREIGN KEY ("purchaseId") REFERENCES "core_payments_purchases"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_payments_customers" ADD CONSTRAINT "core_payments_customers_userId_core_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "core_users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_payments_fulfillments" ADD CONSTRAINT "core_payments_fulfillments_m3ZFaz4wYhVF_fkey" FOREIGN KEY ("purchaseId") REFERENCES "core_payments_purchases"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_payments_invoices" ADD CONSTRAINT "core_payments_invoices_B5KU3edXscf0_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "core_payments_subscriptions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_payments_purchases" ADD CONSTRAINT "core_payments_purchases_userId_core_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "core_users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "core_payments_subscriptions" ADD CONSTRAINT "core_payments_subscriptions_userId_core_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "core_users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "core_payments_subscriptions" ADD CONSTRAINT "core_payments_subscriptions_AIuNRO7ZiDDU_fkey" FOREIGN KEY ("purchaseId") REFERENCES "core_payments_purchases"("id") ON DELETE RESTRICT;