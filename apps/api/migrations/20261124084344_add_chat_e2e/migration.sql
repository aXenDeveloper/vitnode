CREATE TABLE "core_chat_conversation_keys" (
	"conversationId" integer,
	"userId" integer,
	"keyVersion" integer NOT NULL,
	"wrappedKey" jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "core_chat_conversation_keys_pkey" PRIMARY KEY("conversationId","userId")
);
--> statement-breakpoint
ALTER TABLE "core_chat_conversation_keys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_chat_disclosures" (
	"id" serial PRIMARY KEY,
	"reportedMessageId" bigint NOT NULL,
	"messageId" bigint NOT NULL,
	"reporterId" integer NOT NULL,
	"text" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_chat_disclosures" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_chat_user_keys" (
	"userId" integer PRIMARY KEY,
	"publicKey" varchar(128) NOT NULL,
	"passcodeKey" jsonb NOT NULL,
	"recoveryKey" jsonb NOT NULL,
	"keyVersion" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_chat_user_keys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "core_chat_conversations" ADD COLUMN "encrypted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "core_chat_messages" ADD COLUMN "encrypted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "core_chat_messages" ADD COLUMN "commitment" varchar(64);--> statement-breakpoint
ALTER TABLE "core_roles" ADD COLUMN "chatForcePasscode" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "core_chat_conversation_keys_user_idx" ON "core_chat_conversation_keys" ("userId");--> statement-breakpoint
CREATE INDEX "core_chat_disclosures_lookup_idx" ON "core_chat_disclosures" ("reporterId","reportedMessageId");--> statement-breakpoint
ALTER TABLE "core_chat_conversation_keys" ADD CONSTRAINT "core_chat_conversation_keys_5rinuFn9Keeq_fkey" FOREIGN KEY ("conversationId") REFERENCES "core_chat_conversations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_chat_conversation_keys" ADD CONSTRAINT "core_chat_conversation_keys_userId_core_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "core_users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_chat_disclosures" ADD CONSTRAINT "core_chat_disclosures_FyfFUydsRDWx_fkey" FOREIGN KEY ("reportedMessageId") REFERENCES "core_chat_messages"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_chat_disclosures" ADD CONSTRAINT "core_chat_disclosures_messageId_core_chat_messages_id_fkey" FOREIGN KEY ("messageId") REFERENCES "core_chat_messages"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_chat_disclosures" ADD CONSTRAINT "core_chat_disclosures_reporterId_core_users_id_fkey" FOREIGN KEY ("reporterId") REFERENCES "core_users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_chat_user_keys" ADD CONSTRAINT "core_chat_user_keys_userId_core_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "core_users"("id") ON DELETE CASCADE;