CREATE TABLE "core_legal_acceptances" (
	"id" serial PRIMARY KEY,
	"userId" integer NOT NULL,
	"versionId" integer NOT NULL,
	"acceptedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"locale" varchar(32) NOT NULL,
	"wording" text NOT NULL,
	"source" varchar(16) NOT NULL,
	CONSTRAINT "core_legal_acceptances_user_version_unique" UNIQUE("userId","versionId")
);
--> statement-breakpoint
ALTER TABLE "core_legal_acceptances" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_legal_deliveries" (
	"id" serial PRIMARY KEY,
	"versionId" integer NOT NULL,
	"userId" integer NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"skipReason" varchar(16),
	"attempts" integer DEFAULT 0 NOT NULL,
	"lastError" text,
	"providerMessageId" varchar(255),
	"nextAttemptAt" timestamp with time zone DEFAULT now() NOT NULL,
	"lastAttemptAt" timestamp with time zone,
	"sentAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "core_legal_deliveries_version_user_unique" UNIQUE("versionId","userId")
);
--> statement-breakpoint
ALTER TABLE "core_legal_deliveries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_legal_drafts" (
	"documentType" varchar(20) PRIMARY KEY,
	"basedOnVersionId" integer,
	"title" jsonb DEFAULT '[]' NOT NULL,
	"body" jsonb DEFAULT '[]' NOT NULL,
	"summary" jsonb DEFAULT '[]' NOT NULL,
	"acceptanceLabel" jsonb DEFAULT '[]' NOT NULL,
	"requiresAcceptance" boolean DEFAULT false NOT NULL,
	"effectiveAt" timestamp with time zone,
	"revision" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"createdById" integer,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedById" integer
);
--> statement-breakpoint
ALTER TABLE "core_legal_drafts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_legal_fanouts" (
	"versionId" integer PRIMARY KEY,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"cursorUserId" integer DEFAULT 0 NOT NULL,
	"recipientsCreatedBefore" timestamp NOT NULL,
	"incidentAt" timestamp with time zone,
	"lastError" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"completedAt" timestamp with time zone,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_legal_fanouts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_legal_notice_dismissals" (
	"userId" integer,
	"versionId" integer,
	"dismissedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "core_legal_notice_dismissals_pkey" PRIMARY KEY("userId","versionId")
);
--> statement-breakpoint
ALTER TABLE "core_legal_notice_dismissals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_legal_versions" (
	"id" serial PRIMARY KEY,
	"documentType" varchar(20) NOT NULL,
	"version" integer NOT NULL,
	"title" jsonb NOT NULL,
	"body" jsonb NOT NULL,
	"summary" jsonb DEFAULT '[]' NOT NULL,
	"acceptanceLabel" jsonb DEFAULT '[]' NOT NULL,
	"defaultLanguageCode" varchar(32) NOT NULL,
	"requiresAcceptance" boolean DEFAULT false NOT NULL,
	"announcedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"effectiveAt" timestamp with time zone NOT NULL,
	"contentHash" varchar(64) NOT NULL,
	"basedOnVersionId" integer,
	"publishedById" integer,
	CONSTRAINT "core_legal_versions_type_version_unique" UNIQUE("documentType","version"),
	CONSTRAINT "core_legal_versions_acceptance_terms_only" CHECK ("requiresAcceptance" = false OR "documentType" = 'terms'),
	CONSTRAINT "core_legal_versions_version_positive" CHECK ("version" > 0)
);
--> statement-breakpoint
ALTER TABLE "core_legal_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "core_legal_acceptances_version_idx" ON "core_legal_acceptances" ("versionId");--> statement-breakpoint
CREATE INDEX "core_legal_deliveries_version_status_idx" ON "core_legal_deliveries" ("versionId","status","nextAttemptAt");--> statement-breakpoint
CREATE INDEX "core_legal_deliveries_user_idx" ON "core_legal_deliveries" ("userId");--> statement-breakpoint
CREATE INDEX "core_legal_versions_type_effective_idx" ON "core_legal_versions" ("documentType","effectiveAt");--> statement-breakpoint
ALTER TABLE "core_legal_acceptances" ADD CONSTRAINT "core_legal_acceptances_userId_core_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "core_users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_legal_acceptances" ADD CONSTRAINT "core_legal_acceptances_versionId_core_legal_versions_id_fkey" FOREIGN KEY ("versionId") REFERENCES "core_legal_versions"("id");--> statement-breakpoint
ALTER TABLE "core_legal_deliveries" ADD CONSTRAINT "core_legal_deliveries_versionId_core_legal_versions_id_fkey" FOREIGN KEY ("versionId") REFERENCES "core_legal_versions"("id");--> statement-breakpoint
ALTER TABLE "core_legal_deliveries" ADD CONSTRAINT "core_legal_deliveries_userId_core_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "core_users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_legal_drafts" ADD CONSTRAINT "core_legal_drafts_basedOnVersionId_core_legal_versions_id_fkey" FOREIGN KEY ("basedOnVersionId") REFERENCES "core_legal_versions"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "core_legal_drafts" ADD CONSTRAINT "core_legal_drafts_createdById_core_users_id_fkey" FOREIGN KEY ("createdById") REFERENCES "core_users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "core_legal_drafts" ADD CONSTRAINT "core_legal_drafts_updatedById_core_users_id_fkey" FOREIGN KEY ("updatedById") REFERENCES "core_users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "core_legal_fanouts" ADD CONSTRAINT "core_legal_fanouts_versionId_core_legal_versions_id_fkey" FOREIGN KEY ("versionId") REFERENCES "core_legal_versions"("id");--> statement-breakpoint
ALTER TABLE "core_legal_notice_dismissals" ADD CONSTRAINT "core_legal_notice_dismissals_userId_core_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "core_users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_legal_notice_dismissals" ADD CONSTRAINT "core_legal_notice_dismissals_SLBwHX93n6Wl_fkey" FOREIGN KEY ("versionId") REFERENCES "core_legal_versions"("id");--> statement-breakpoint
ALTER TABLE "core_legal_versions" ADD CONSTRAINT "core_legal_versions_RLkOd5G2g0zv_fkey" FOREIGN KEY ("basedOnVersionId") REFERENCES "core_legal_versions"("id");--> statement-breakpoint
ALTER TABLE "core_legal_versions" ADD CONSTRAINT "core_legal_versions_publishedById_core_users_id_fkey" FOREIGN KEY ("publishedById") REFERENCES "core_users"("id") ON DELETE SET NULL;--> statement-breakpoint
CREATE OR REPLACE FUNCTION "core_legal_versions_immutable"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN
		RAISE EXCEPTION 'Announced legal document versions cannot be deleted' USING ERRCODE = 'restrict_violation';
	END IF;
	IF (to_jsonb(NEW) - 'publishedById') IS DISTINCT FROM (to_jsonb(OLD) - 'publishedById') THEN
		RAISE EXCEPTION 'Announced legal document versions are immutable; publish a new version instead' USING ERRCODE = 'restrict_violation';
	END IF;
	RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "core_legal_versions_immutable" BEFORE UPDATE OR DELETE ON "core_legal_versions" FOR EACH ROW EXECUTE FUNCTION "core_legal_versions_immutable"();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "core_legal_acceptances_append_only"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	RAISE EXCEPTION 'Terms acceptances are append-only' USING ERRCODE = 'restrict_violation';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "core_legal_acceptances_append_only" BEFORE UPDATE ON "core_legal_acceptances" FOR EACH ROW EXECUTE FUNCTION "core_legal_acceptances_append_only"();
