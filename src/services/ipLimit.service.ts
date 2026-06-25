import fs from 'fs/promises';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'ip_limits.json');

interface IpLimitRecord {
  ipAddress: string;
  limit: number;
  count: number;
  updatedAt: number;
}

async function ensureDataDir() {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
}

async function readRecords(): Promise<IpLimitRecord[]> {
  try {
    const txt = await fs.readFile(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(txt || '[]') as IpLimitRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeRecords(records: IpLimitRecord[]) {
  await ensureDataDir();
  await fs.writeFile(DATA_FILE, JSON.stringify(records, null, 2), 'utf-8');
}

function normalizeIp(ipAddress: string): string {
  return String(ipAddress || '').trim().toLowerCase();
}

export async function getIpCreationLimit(ipAddress: string): Promise<number> {
  const normalized = normalizeIp(ipAddress);
  if (!normalized) return 3;
  const records = await readRecords();
  const found = records.find((entry) => entry.ipAddress === normalized);
  return found?.limit ?? 3;
}

export async function getIpCreationUsage(ipAddress: string): Promise<number> {
  const normalized = normalizeIp(ipAddress);
  if (!normalized) return 0;
  const records = await readRecords();
  const found = records.find((entry) => entry.ipAddress === normalized);
  return found?.count ?? 0;
}

export async function incrementIpCreationUsage(ipAddress: string): Promise<{ limit: number; count: number }> {
  const normalized = normalizeIp(ipAddress);
  const records = await readRecords();
  const existingIndex = records.findIndex((entry) => entry.ipAddress === normalized);
  const limit = existingIndex >= 0 ? records[existingIndex].limit ?? 3 : 3;
  const nextCount = (existingIndex >= 0 ? records[existingIndex].count ?? 0 : 0) + 1;
  const entry: IpLimitRecord = {
    ipAddress: normalized,
    limit,
    count: nextCount,
    updatedAt: Date.now(),
  };

  if (existingIndex >= 0) records[existingIndex] = entry;
  else records.push(entry);

  await writeRecords(records);
  return { limit, count: nextCount };
}

export async function updateIpCreationLimit(ipAddress: string, limit: number): Promise<{ limit: number; count: number }> {
  const normalized = normalizeIp(ipAddress);
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 3;
  const records = await readRecords();
  const existingIndex = records.findIndex((entry) => entry.ipAddress === normalized);
  const existing = existingIndex >= 0 ? records[existingIndex] : { ipAddress: normalized, limit: safeLimit, count: 0, updatedAt: Date.now() };
  const entry: IpLimitRecord = {
    ipAddress: normalized,
    limit: safeLimit,
    count: existing.count ?? 0,
    updatedAt: Date.now(),
  };

  if (existingIndex >= 0) records[existingIndex] = entry;
  else records.push(entry);

  await writeRecords(records);
  return { limit: safeLimit, count: entry.count };
}

export async function canCreateUserFromIp(ipAddress: string, existingCount: number): Promise<{ allowed: boolean; limit: number; currentCount: number }> {
  const limit = await getIpCreationLimit(ipAddress);
  return { allowed: existingCount < limit, limit, currentCount: existingCount };
}
