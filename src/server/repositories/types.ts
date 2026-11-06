/** Plain data shapes returned by repositories. Components and services depend on these, never on Prisma. */
export type AccessMode = "official_api" | "assisted_ingest" | "manual_import";
export type FormScope = "league" | "overall";
export type RunStatus = "RUNNING" | "SUCCESS" | "PARTIAL" | "FAILED" | "SKIPPED";
export type RunTrigger = "CRON" | "MANUAL" | "INGEST" | "IMPORT";
export type Side = "HOME" | "AWAY";
export type Confidence = "LOW" | "MEDIUM" | "HIGH";

export type SettingRecord = {
  id: number;
  highThreshold: number;
  lowThreshold: number;
  windowDays: number;
  formScope: FormScope;
  timezone: string;
  runHourLocal: number;
  accessMode: AccessMode;
  staleAfterHrs: number;
  sessionVersion: number;
  updatedAt: Date;
};

export type SettingUpdate = Partial<Omit<SettingRecord, "id" | "updatedAt" | "sessionVersion">>;

export type MatchRecord = {
  id: string;
  provider: string;
  providerMatchId: string;
  sourceUrl: string | null;
  kickoffAt: Date;
  league: string | null;
  country: string | null;
  homeName: string;
  awayName: string;
  homeLogoUrl: string | null;
  awayLogoUrl: string | null;
  homeFormPct: number;
  awayFormPct: number;
  formScope: FormScope;
  homeLastResults: string | null;
  awayLastResults: string | null;
  pHomeWin: number | null;
  pDraw: number | null;
  pAwayWin: number | null;
  pBtts: number | null;
  pOver25: number | null;
  predHomeGoals: number | null;
  predAwayGoals: number | null;
  confidence: Confidence | null;
  qualifies: boolean;
  strongSide: Side | null;
  formGap: number;
  firstRunId: string | null;
  lastRunId: string | null;
  fetchedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

/** Fields written by `upsertMany` (ids and timestamps are managed by the database). */
export type MatchInput = Omit<MatchRecord, "id" | "createdAt" | "updatedAt" | "firstRunId">;

export type RunRecord = {
  id: string;
  trigger: RunTrigger;
  provider: string;
  status: RunStatus;
  startedAt: Date;
  finishedAt: Date | null;
  windowFrom: Date | null;
  windowTo: Date | null;
  scanned: number;
  qualified: number;
  failedCount: number;
  error: string | null;
  details: unknown;
};

export type RunFinish = {
  status: Exclude<RunStatus, "RUNNING">;
  finishedAt: Date;
  scanned?: number;
  qualified?: number;
  failedCount?: number;
  error?: string | null;
  details?: unknown;
};

export type TokenRecord = {
  id: string;
  label: string;
  tokenHash: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
};

export type LoginAttemptRecord = { id: string; ip: string; at: Date; success: boolean };
