CREATE TABLE "core_chat_conversations" (
	"id" serial PRIMARY KEY,
	"kind" varchar(16) NOT NULL,
	"directKey" varchar(32) UNIQUE,
	"title" varchar(100),
	"hostId" integer,
	"membersCanInvite" boolean DEFAULT true NOT NULL,
	"lastMessageId" bigint,
	"lastMessageAt" timestamp,
	"membersCount" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_chat_conversations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_chat_message_reactions" (
	"messageId" bigint,
	"userId" integer,
	"emoji" varchar(32),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "core_chat_message_reactions_pkey" PRIMARY KEY("messageId","userId","emoji")
);
--> statement-breakpoint
ALTER TABLE "core_chat_message_reactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_chat_messages" (
	"id" bigserial PRIMARY KEY,
	"conversationId" integer NOT NULL,
	"authorId" integer,
	"kind" varchar(16) NOT NULL,
	"body" text,
	"system" jsonb,
	"replyToMessageId" bigint,
	"clientId" varchar(64),
	"sentAsRequest" boolean DEFAULT false NOT NULL,
	"hiddenByModeratorAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"editedAt" timestamp,
	"deletedAt" timestamp,
	CONSTRAINT "core_chat_messages_client_key" UNIQUE("authorId","clientId")
);
--> statement-breakpoint
ALTER TABLE "core_chat_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_chat_participants" (
	"conversationId" integer,
	"userId" integer,
	"status" varchar(16) NOT NULL,
	"invitedById" integer,
	"invitedAt" timestamp DEFAULT now() NOT NULL,
	"acceptedAt" timestamp,
	"leftAt" timestamp,
	"firstVisibleMessageId" bigint DEFAULT 0 NOT NULL,
	"hiddenUntilMessageId" bigint,
	"lastReadMessageId" bigint DEFAULT 0 NOT NULL,
	"mutedUntil" timestamp,
	CONSTRAINT "core_chat_participants_pkey" PRIMARY KEY("conversationId","userId")
);
--> statement-breakpoint
ALTER TABLE "core_chat_participants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_chat_request_outcomes" (
	"id" serial PRIMARY KEY,
	"senderId" integer NOT NULL,
	"recipientId" integer,
	"outcome" varchar(16) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_chat_request_outcomes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_users_blocks" (
	"userId" integer,
	"blockedUserId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "core_users_blocks_pkey" PRIMARY KEY("userId","blockedUserId"),
	CONSTRAINT "core_users_blocks_not_self" CHECK ("userId" <> "blockedUserId")
);
--> statement-breakpoint
ALTER TABLE "core_users_blocks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "core_roles" ADD COLUMN "allowChat" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "core_roles" ADD COLUMN "chatRequestsPerDay" integer DEFAULT 20;--> statement-breakpoint
ALTER TABLE "core_roles" ADD COLUMN "chatMaxInvites" integer DEFAULT 10;--> statement-breakpoint
ALTER TABLE "core_users" ADD COLUMN "chatRequestsFrom" varchar(16) DEFAULT 'everyone' NOT NULL;--> statement-breakpoint
ALTER TABLE "core_users" ADD COLUMN "showReadReceipts" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX "core_chat_conversations_last_message_at_idx" ON "core_chat_conversations" ("lastMessageAt");--> statement-breakpoint
CREATE INDEX "core_chat_message_reactions_user_idx" ON "core_chat_message_reactions" ("userId");--> statement-breakpoint
CREATE INDEX "core_chat_messages_page_idx" ON "core_chat_messages" ("conversationId","id");--> statement-breakpoint
CREATE INDEX "core_chat_messages_author_idx" ON "core_chat_messages" ("authorId");--> statement-breakpoint
CREATE INDEX "core_chat_messages_reply_idx" ON "core_chat_messages" ("replyToMessageId");--> statement-breakpoint
CREATE INDEX "core_chat_participants_list_idx" ON "core_chat_participants" ("userId","leftAt","status");--> statement-breakpoint
CREATE INDEX "core_chat_request_outcomes_sender_idx" ON "core_chat_request_outcomes" ("senderId","createdAt");--> statement-breakpoint
CREATE INDEX "core_users_blocks_blocked_idx" ON "core_users_blocks" ("blockedUserId");--> statement-breakpoint
ALTER TABLE "core_chat_conversations" ADD CONSTRAINT "core_chat_conversations_hostId_core_users_id_fkey" FOREIGN KEY ("hostId") REFERENCES "core_users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "core_chat_message_reactions" ADD CONSTRAINT "core_chat_message_reactions_3bZ8Vpa29WQw_fkey" FOREIGN KEY ("messageId") REFERENCES "core_chat_messages"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_chat_message_reactions" ADD CONSTRAINT "core_chat_message_reactions_userId_core_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "core_users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_chat_messages" ADD CONSTRAINT "core_chat_messages_sbLBs0CUEl4s_fkey" FOREIGN KEY ("conversationId") REFERENCES "core_chat_conversations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_chat_messages" ADD CONSTRAINT "core_chat_messages_authorId_core_users_id_fkey" FOREIGN KEY ("authorId") REFERENCES "core_users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "core_chat_messages" ADD CONSTRAINT "core_chat_messages_replyToMessageId_core_chat_messages_id_fkey" FOREIGN KEY ("replyToMessageId") REFERENCES "core_chat_messages"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "core_chat_participants" ADD CONSTRAINT "core_chat_participants_wQA6gInkXCIm_fkey" FOREIGN KEY ("conversationId") REFERENCES "core_chat_conversations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_chat_participants" ADD CONSTRAINT "core_chat_participants_userId_core_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "core_users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_chat_participants" ADD CONSTRAINT "core_chat_participants_invitedById_core_users_id_fkey" FOREIGN KEY ("invitedById") REFERENCES "core_users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "core_chat_request_outcomes" ADD CONSTRAINT "core_chat_request_outcomes_senderId_core_users_id_fkey" FOREIGN KEY ("senderId") REFERENCES "core_users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_chat_request_outcomes" ADD CONSTRAINT "core_chat_request_outcomes_recipientId_core_users_id_fkey" FOREIGN KEY ("recipientId") REFERENCES "core_users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "core_users_blocks" ADD CONSTRAINT "core_users_blocks_userId_core_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "core_users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_users_blocks" ADD CONSTRAINT "core_users_blocks_blockedUserId_core_users_id_fkey" FOREIGN KEY ("blockedUserId") REFERENCES "core_users"("id") ON DELETE CASCADE;--> statement-breakpoint
UPDATE "core_roles" SET "allowChat" = false WHERE "guest" = true;
