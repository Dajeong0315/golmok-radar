import { DRAFT_KEY, PROFILE_HISTORY_KEY, PROFILE_KEY, SKIPPED_KEY } from "./founderProfile";
import { FAVORITES_KEY, SYNC_OWNER_KEY } from "./favorites";
import { PROPERTY_WORKSHEETS_KEY } from "./propertyWorksheet";

export const ANONYMOUS_SESSION_KEY = "golmok-radar:anonymous-session:v1";
export const ANONYMOUS_TRANSFER_KEY = "golmok-radar:anonymous-transfer:v1";
const ACCOUNT_TRANSFER_PREFIX = "golmok-radar:account-transfer:v1:";
export const ANONYMOUS_RETENTION_MS = 60 * 60 * 1000;
export const LOGIN_PROTECTION_MS = 15 * 60 * 1000;

const RECORD_KEYS = [FAVORITES_KEY, PROFILE_KEY, PROFILE_HISTORY_KEY, DRAFT_KEY, SKIPPED_KEY, PROPERTY_WORKSHEETS_KEY] as const;

type Session = {
  schemaVersion: 1;
  anonymousSessionId: string;
  lastActivityAt: number;
  expiresAt: number;
  lastReminderAt?: number;
};

export type AnonymousTransferSnapshot = {
  schemaVersion: 1;
  batchId: string;
  createdAt: number;
  protectedUntil: number;
  returnHash: string;
  records: Record<string, string>;
  userId?: string;
};

export type AnonymousStatus = {
  state: "empty" | "active" | "expired" | "protected";
  remainingMs: number;
  hasRecords: boolean;
};

type StoragePort = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function accountTransferKey(userId: string): string {
  return `${ACCOUNT_TRANSFER_PREFIX}${userId}`;
}

function accountTransfers(storage: StoragePort, userId: string): AnonymousTransferSnapshot[] {
  const stored = parse<AnonymousTransferSnapshot | AnonymousTransferSnapshot[]>(storage, accountTransferKey(userId));
  const snapshots = Array.isArray(stored) ? stored : stored ? [stored] : [];
  return snapshots.filter((snapshot) => validTransfer(snapshot) && snapshot.userId === userId);
}

function appendAccountTransfer(storage: StoragePort, snapshot: AnonymousTransferSnapshot & { userId: string }): void {
  const snapshots = accountTransfers(storage, snapshot.userId);
  if (snapshots.some((existing) => existing.batchId === snapshot.batchId)) return;
  storage.setItem(accountTransferKey(snapshot.userId), JSON.stringify([...snapshots, snapshot]));
}

function moveAssignedTransfer(storage: StoragePort): void {
  const transfer = parse<AnonymousTransferSnapshot>(storage, ANONYMOUS_TRANSFER_KEY);
  if (!validTransfer(transfer) || !transfer.userId) return;
  appendAccountTransfer(storage, transfer as AnonymousTransferSnapshot & { userId: string });
  storage.removeItem(ANONYMOUS_TRANSFER_KEY);
}

/** Keep a previous account's browser cache out of the newly signed-in account. */
export function claimAccountLocalCache(storage: StoragePort, userId: string): void {
  moveAssignedTransfer(storage);
  const previousOwner = storage.getItem(SYNC_OWNER_KEY);
  if (previousOwner && previousOwner !== userId) {
    RECORD_KEYS.forEach((key) => storage.removeItem(key));
    storage.removeItem(ANONYMOUS_SESSION_KEY);
    const transfer = parse<AnonymousTransferSnapshot>(storage, ANONYMOUS_TRANSFER_KEY);
    if (!validTransfer(transfer) || !transfer.userId) storage.removeItem(ANONYMOUS_TRANSFER_KEY);
  }
  storage.setItem(SYNC_OWNER_KEY, userId);
}

/** End the account's browser session without treating its cached records as guest data. */
export function releaseAccountLocalCache(storage: StoragePort): void {
  moveAssignedTransfer(storage);
  if (!storage.getItem(SYNC_OWNER_KEY)) return;
  RECORD_KEYS.forEach((key) => storage.removeItem(key));
  storage.removeItem(ANONYMOUS_SESSION_KEY);
  storage.removeItem(SYNC_OWNER_KEY);
  announce();
}

/** Remove this account's cached records after a confirmed server deletion. */
export function clearAccountRecordCache(storage: StoragePort, userId: string): void {
  if (storage.getItem(SYNC_OWNER_KEY) !== userId) return;
  moveAssignedTransfer(storage);
  RECORD_KEYS.forEach((key) => storage.removeItem(key));
  storage.removeItem(ANONYMOUS_SESSION_KEY);
  storage.removeItem(accountTransferKey(userId));
  const transfer = parse<AnonymousTransferSnapshot>(storage, ANONYMOUS_TRANSFER_KEY);
  if (!validTransfer(transfer) || !transfer.userId || transfer.userId === userId) storage.removeItem(ANONYMOUS_TRANSFER_KEY);
  announce();
}

function announce(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("golmok-anonymous-session"));
}

function parse<T>(storage: Pick<Storage, "getItem">, key: string): T | null {
  try { return JSON.parse(storage.getItem(key) || "null") as T | null; } catch { return null; }
}

function meaningful(value: string | null): boolean {
  return Boolean(value && !["", "null", "[]", "{}"].includes(value));
}

function hasRecords(storage: Pick<Storage, "getItem">): boolean {
  // Account-owned browser caches must never be reclassified as anonymous after logout.
  if (storage.getItem(SYNC_OWNER_KEY)) return false;
  return RECORD_KEYS.some((key) => meaningful(storage.getItem(key)));
}

function validSession(value: Session | null): value is Session {
  return Boolean(value && value.schemaVersion === 1 && typeof value.anonymousSessionId === "string" && Number.isFinite(value.lastActivityAt) && Number.isFinite(value.expiresAt));
}

function validTransfer(value: AnonymousTransferSnapshot | null): value is AnonymousTransferSnapshot {
  return Boolean(value && value.schemaVersion === 1 && typeof value.batchId === "string" && Number.isFinite(value.protectedUntil) && value.records && typeof value.records === "object");
}

function id(prefix: string, now: number): string {
  return `${prefix}-${now}-${Math.random().toString(36).slice(2, 10)}`;
}

function removeAnonymousRecords(storage: StoragePort): void {
  RECORD_KEYS.forEach((key) => storage.removeItem(key));
  storage.removeItem(ANONYMOUS_SESSION_KEY);
  storage.removeItem(ANONYMOUS_TRANSFER_KEY);
}

function readSession(storage: StoragePort): Session | null {
  const value = parse<Session>(storage, ANONYMOUS_SESSION_KEY);
  return validSession(value) ? value : null;
}

/** Converts the former per-feature localStorage records into one expiring anonymous session. */
export function ensureAnonymousSession(storage: StoragePort, now = Date.now()): Session | null {
  if (!hasRecords(storage)) return null;
  const current = readSession(storage);
  if (current) return current;
  const session: Session = { schemaVersion: 1, anonymousSessionId: id("anonymous", now), lastActivityAt: now, expiresAt: now + ANONYMOUS_RETENTION_MS };
  storage.setItem(ANONYMOUS_SESSION_KEY, JSON.stringify(session));
  announce();
  return session;
}

/** Call immediately after a feature has written its first anonymous record. */
export function registerAnonymousRecord(storage: StoragePort, now = Date.now()): void {
  ensureAnonymousSession(storage, now);
  announce();
}

/** Must run before a read or write; an expired session can never be revived by a later activity event. */
export function expireAnonymousSession(storage: StoragePort, now = Date.now(), authenticated = false): AnonymousStatus {
  if (authenticated) return { state: hasRecords(storage) ? "protected" : "empty", remainingMs: 0, hasRecords: hasRecords(storage) };
  const transfer = parse<AnonymousTransferSnapshot>(storage, ANONYMOUS_TRANSFER_KEY);
  if (validTransfer(transfer) && (transfer.userId ? !storage.getItem(SYNC_OWNER_KEY) : transfer.protectedUntil > now)) {
    return { state: "protected", remainingMs: Math.max(0, transfer.protectedUntil - now), hasRecords: true };
  }
  const session = ensureAnonymousSession(storage, now);
  if (!session) return { state: "empty", remainingMs: 0, hasRecords: false };
  if (now >= session.expiresAt) {
    removeAnonymousRecords(storage);
    announce();
    return { state: "expired", remainingMs: 0, hasRecords: false };
  }
  return { state: "active", remainingMs: session.expiresAt - now, hasRecords: true };
}

/** Records only real user activity. Callers must not invoke this from timers, fetches, or rendering. */
export function touchAnonymousActivity(storage: StoragePort, now = Date.now()): AnonymousStatus {
  const before = expireAnonymousSession(storage, now);
  if (before.state !== "active") return before;
  const session = readSession(storage)!;
  const next: Session = { ...session, lastActivityAt: now, expiresAt: now + ANONYMOUS_RETENTION_MS };
  storage.setItem(ANONYMOUS_SESSION_KEY, JSON.stringify(next));
  announce();
  return { state: "active", remainingMs: ANONYMOUS_RETENTION_MS, hasRecords: true };
}

export function captureAnonymousTransfer(storage: StoragePort, returnHash: string, now = Date.now()): AnonymousTransferSnapshot | null {
  const status = expireAnonymousSession(storage, now);
  if (status.state !== "active") return null;
  const records = Object.fromEntries(RECORD_KEYS.flatMap((key) => {
    const value = storage.getItem(key);
    return meaningful(value) ? [[key, value!]] : [];
  }));
  if (!Object.keys(records).length) return null;
  const snapshot: AnonymousTransferSnapshot = { schemaVersion: 1, batchId: id("transfer", now), createdAt: now, protectedUntil: now + LOGIN_PROTECTION_MS, returnHash, records };
  storage.setItem(ANONYMOUS_TRANSFER_KEY, JSON.stringify(snapshot));
  announce();
  return snapshot;
}

/** Authentication has completed; Phase 25 will upload this owner-scoped snapshot before clearing it. */
export function assignAnonymousTransfer(storage: StoragePort, userId: string, now = Date.now()): void {
  let snapshot = parse<AnonymousTransferSnapshot>(storage, ANONYMOUS_TRANSFER_KEY);
  if (!validTransfer(snapshot) || snapshot.userId) return;
  const previousOwner = storage.getItem(SYNC_OWNER_KEY);
  if (previousOwner && previousOwner !== userId) return;
  if (snapshot.protectedUntil <= now) {
    const status = expireAnonymousSession(storage, now);
    if (status.state !== "active") return;
    snapshot = captureAnonymousTransfer(storage, snapshot.returnHash, now);
    if (!snapshot) return;
  }
  appendAccountTransfer(storage, { ...snapshot, userId });
  storage.removeItem(ANONYMOUS_TRANSFER_KEY);
  announce();
}

export function transferReturnHash(storage: StoragePort, userId: string): string | null {
  const snapshots = accountTransfers(storage, userId);
  const snapshot = snapshots[snapshots.length - 1] || pendingAnonymousTransfer(storage, userId);
  return snapshot?.returnHash.startsWith("#") ? snapshot.returnHash : null;
}

export function pendingAnonymousTransfer(storage: StoragePort, userId: string): AnonymousTransferSnapshot | null {
  const snapshot = accountTransfers(storage, userId)[0]
    || parse<AnonymousTransferSnapshot>(storage, ANONYMOUS_TRANSFER_KEY);
  return validTransfer(snapshot) && snapshot.userId === userId ? snapshot : null;
}

/** Only call after every record in the batch has been confirmed by the server. */
export function clearTransferredAnonymousRecords(storage: StoragePort, userId: string): void {
  const snapshot = pendingAnonymousTransfer(storage, userId);
  if (!snapshot) return;
  RECORD_KEYS.forEach((key) => {
    if (snapshot.records[key] !== undefined && storage.getItem(key) === snapshot.records[key]) storage.removeItem(key);
  });
  storage.removeItem(ANONYMOUS_SESSION_KEY);
  const remaining = accountTransfers(storage, userId).filter((candidate) => candidate.batchId !== snapshot.batchId);
  if (remaining.length) storage.setItem(accountTransferKey(userId), JSON.stringify(remaining));
  else storage.removeItem(accountTransferKey(userId));
  const legacy = parse<AnonymousTransferSnapshot>(storage, ANONYMOUS_TRANSFER_KEY);
  if (validTransfer(legacy) && legacy.userId === userId && legacy.batchId === snapshot.batchId) storage.removeItem(ANONYMOUS_TRANSFER_KEY);
  announce();
}

export function anonymousNotice(storage: StoragePort, now = Date.now()): { status: AnonymousStatus; showReminder: boolean } {
  const status = expireAnonymousSession(storage, now);
  const session = readSession(storage);
  if (status.state !== "active" || !session) return { status, showReminder: false };
  return { status, showReminder: !session.lastReminderAt || now - session.lastReminderAt >= 20 * 60 * 1000 };
}

export function markAnonymousReminderShown(storage: StoragePort, now = Date.now()): void {
  const session = readSession(storage);
  if (session) storage.setItem(ANONYMOUS_SESSION_KEY, JSON.stringify({ ...session, lastReminderAt: now }));
}

export function formatRemainingTime(remainingMs: number): string {
  const minutes = Math.max(1, Math.ceil(remainingMs / 60_000));
  return `${minutes}분`;
}
