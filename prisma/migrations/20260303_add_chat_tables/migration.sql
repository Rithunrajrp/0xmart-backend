-- CreateEnum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ChatRole') THEN
    CREATE TYPE "ChatRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM', 'TOOL');
  END IF;
END $$;

-- CreateTable chat_sessions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'chat_sessions'
  ) THEN
    CREATE TABLE "chat_sessions" (
        "id" TEXT NOT NULL,
        "userId" TEXT,
        "guestId" TEXT,
        "title" TEXT,
        "isReadOnly" BOOLEAN NOT NULL DEFAULT false,
        "relatedOrderId" TEXT,
        "context" JSONB,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        "expiresAt" TIMESTAMP(3),

        CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
    );
  END IF;
END $$;

-- CreateTable chat_messages
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'chat_messages'
  ) THEN
    CREATE TABLE "chat_messages" (
        "id" TEXT NOT NULL,
        "sessionId" TEXT NOT NULL,
        "role" "ChatRole" NOT NULL,
        "content" TEXT NOT NULL,
        "metadata" JSONB,
        "toolCalls" JSONB,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
    );
  END IF;
END $$;

-- Add missing columns to chat_sessions if table exists
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'chat_sessions'
  ) THEN
    -- Add isReadOnly column if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'chat_sessions'
      AND column_name = 'isReadOnly'
    ) THEN
      ALTER TABLE "chat_sessions" ADD COLUMN "isReadOnly" BOOLEAN NOT NULL DEFAULT false;
    END IF;

    -- Add relatedOrderId column if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'chat_sessions'
      AND column_name = 'relatedOrderId'
    ) THEN
      ALTER TABLE "chat_sessions" ADD COLUMN "relatedOrderId" TEXT;
    END IF;
  END IF;
END $$;

-- CreateIndexes
CREATE INDEX IF NOT EXISTS "chat_sessions_userId_idx" ON "chat_sessions"("userId");
CREATE INDEX IF NOT EXISTS "chat_sessions_guestId_idx" ON "chat_sessions"("guestId");
CREATE INDEX IF NOT EXISTS "chat_sessions_createdAt_idx" ON "chat_sessions"("createdAt");

-- Conditional indexes (only if columns exist)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'chat_sessions'
    AND column_name = 'isReadOnly'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public'
      AND tablename = 'chat_sessions'
      AND indexname = 'chat_sessions_isReadOnly_idx'
    ) THEN
      CREATE INDEX "chat_sessions_isReadOnly_idx" ON "chat_sessions"("isReadOnly");
    END IF;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'chat_sessions'
    AND column_name = 'relatedOrderId'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public'
      AND tablename = 'chat_sessions'
      AND indexname = 'chat_sessions_relatedOrderId_idx'
    ) THEN
      CREATE INDEX "chat_sessions_relatedOrderId_idx" ON "chat_sessions"("relatedOrderId");
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "chat_messages_sessionId_idx" ON "chat_messages"("sessionId");
CREATE INDEX IF NOT EXISTS "chat_messages_createdAt_idx" ON "chat_messages"("createdAt");

-- AddForeignKeys
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'chat_sessions_userId_fkey'
  ) THEN
    ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'chat_messages_sessionId_fkey'
  ) THEN
    ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
