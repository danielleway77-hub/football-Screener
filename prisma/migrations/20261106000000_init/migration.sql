-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AccessMode" AS ENUM ('official_api', 'assisted_ingest', 'manual_import');

-- CreateEnum
CREATE TYPE "FormScope" AS ENUM ('league', 'overall');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "RunTrigger" AS ENUM ('CRON', 'MANUAL', 'INGEST', 'IMPORT');

-- CreateEnum
CREATE TYPE "Side" AS ENUM ('HOME', 'AWAY');

-- CreateEnum
CREATE TYPE "Confidence" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "Setting" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "highThreshold" INTEGER NOT NULL DEFAULT 75,
    "lowThreshold" INTEGER NOT NULL DEFAULT 35,
    "windowDays" INTEGER NOT NULL DEFAULT 2,
    "formScope" "FormScope" NOT NULL DEFAULT 'league',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/London',
    "runHourLocal" INTEGER NOT NULL DEFAULT 7,
    "accessMode" "AccessMode" NOT NULL DEFAULT 'manual_import',
    "staleAfterHrs" INTEGER NOT NULL DEFAULT 26,
    "sessionVersion" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Credential" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "passwordHash" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Credential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerMatchId" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "kickoffAt" TIMESTAMP(3) NOT NULL,
    "league" TEXT,
    "country" TEXT,
    "homeName" TEXT NOT NULL,
    "awayName" TEXT NOT NULL,
    "homeLogoUrl" TEXT,
    "awayLogoUrl" TEXT,
    "homeFormPct" DOUBLE PRECISION NOT NULL,
    "awayFormPct" DOUBLE PRECISION NOT NULL,
    "formScope" "FormScope" NOT NULL,
    "homeLastResults" TEXT,
    "awayLastResults" TEXT,
    "pHomeWin" DOUBLE PRECISION,
    "pDraw" DOUBLE PRECISION,
    "pAwayWin" DOUBLE PRECISION,
    "pBtts" DOUBLE PRECISION,
    "pOver25" DOUBLE PRECISION,
    "predHomeGoals" INTEGER,
    "predAwayGoals" INTEGER,
    "confidence" "Confidence",
    "qualifies" BOOLEAN NOT NULL DEFAULT false,
    "strongSide" "Side",
    "formGap" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "firstRunId" TEXT,
    "lastRunId" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreeningRun" (
    "id" TEXT NOT NULL,
    "trigger" "RunTrigger" NOT NULL,
    "provider" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "windowFrom" TIMESTAMP(3),
    "windowTo" TIMESTAMP(3),
    "scanned" INTEGER NOT NULL DEFAULT 0,
    "qualified" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "details" JSONB,

    CONSTRAINT "ScreeningRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunMatch" (
    "runId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "qualifiedAtRun" BOOLEAN NOT NULL,

    CONSTRAINT "RunMatch_pkey" PRIMARY KEY ("runId","matchId")
);

-- CreateTable
CREATE TABLE "IngestToken" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "IngestToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "success" BOOLEAN NOT NULL,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "Match_kickoffAt_idx" ON "Match"("kickoffAt");

-- CreateIndex
CREATE INDEX "Match_qualifies_kickoffAt_idx" ON "Match"("qualifies", "kickoffAt");

-- CreateIndex
CREATE UNIQUE INDEX "Match_provider_providerMatchId_key" ON "Match"("provider", "providerMatchId");

-- CreateIndex
CREATE INDEX "ScreeningRun_startedAt_idx" ON "ScreeningRun"("startedAt");

-- CreateIndex
CREATE INDEX "ScreeningRun_status_startedAt_idx" ON "ScreeningRun"("status", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "IngestToken_tokenHash_key" ON "IngestToken"("tokenHash");

-- CreateIndex
CREATE INDEX "LoginAttempt_ip_at_idx" ON "LoginAttempt"("ip", "at");

-- CreateIndex
CREATE INDEX "RateLimit_windowStart_idx" ON "RateLimit"("windowStart");

-- AddForeignKey
ALTER TABLE "RunMatch" ADD CONSTRAINT "RunMatch_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ScreeningRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunMatch" ADD CONSTRAINT "RunMatch_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Concurrency guard: at most ONE run may be RUNNING at any time.
CREATE UNIQUE INDEX "one_running_run" ON "ScreeningRun" ((status)) WHERE status = 'RUNNING';

-- Defence in depth for Setting (zod validates first; the database refuses nonsense too).
ALTER TABLE "Setting" ADD CONSTRAINT "Setting_thresholds_check" CHECK ("lowThreshold" >= 0 AND "highThreshold" <= 100 AND "lowThreshold" < "highThreshold");
ALTER TABLE "Setting" ADD CONSTRAINT "Setting_windowDays_check" CHECK ("windowDays" IN (1, 2));
ALTER TABLE "Setting" ADD CONSTRAINT "Setting_runHourLocal_check" CHECK ("runHourLocal" BETWEEN 0 AND 23);
ALTER TABLE "Setting" ADD CONSTRAINT "Setting_staleAfterHrs_check" CHECK ("staleAfterHrs" BETWEEN 1 AND 168);
