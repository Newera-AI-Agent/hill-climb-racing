'use client';

export const SAVE_VERSION = 1;
const SAVE_KEY = 'hillclimb.save.v1';

export type StageId = 'countryside' | 'moon';
export type UpgradeId = 'engine' | 'suspension' | 'tires' | 'fuelTank';

export interface Upgrades {
  engine: number;      // 0..4 (5 levels incl. base)
  suspension: number;
  tires: number;
  fuelTank: number;
}

export interface SaveData {
  version: number;
  coins: number;
  muted: boolean;
  upgrades: Upgrades;
  best: Record<StageId, number>; // meters
}

export const DEFAULT_SAVE: SaveData = {
  version: SAVE_VERSION,
  coins: 0,
  muted: false,
  upgrades: { engine: 0, suspension: 0, tires: 0, fuelTank: 0 },
  best: { countryside: 0, moon: 0 },
};

export const MAX_UPGRADE_LEVEL = 4;
export const UPGRADE_IDS: UpgradeId[] = ['engine', 'suspension', 'tires', 'fuelTank'];

export const STAGES: { id: StageId; name: string; gravity: number; blurb: string }[] = [
  { id: 'countryside', name: 'Countryside', gravity: 1, blurb: 'Rolling green hills. Normal gravity.' },
  { id: 'moon', name: 'Moon', gravity: 0.32, blurb: 'Low gravity. Huge airtime, brutal flips.' },
];

export function upgradeCost(id: UpgradeId, level: number): number {
  const base: Record<UpgradeId, number> = { engine: 250, suspension: 200, tires: 180, fuelTank: 150 };
  // level is the CURRENT level (0-based); cost to buy next level
  return Math.round(base[id] * Math.pow(1.8, level));
}

function sanitize(raw: unknown): SaveData {
  const s = structuredClone(DEFAULT_SAVE);
  if (typeof raw !== 'object' || raw === null) return s;
  const r = raw as Record<string, unknown>;
  if (r.version !== SAVE_VERSION) return s; // future: migrations
  if (typeof r.coins === 'number' && isFinite(r.coins) && r.coins >= 0) s.coins = Math.floor(r.coins);
  if (typeof r.muted === 'boolean') s.muted = r.muted;
  if (typeof r.upgrades === 'object' && r.upgrades !== null) {
    const u = r.upgrades as Record<string, unknown>;
    for (const id of UPGRADE_IDS) {
      const v = u[id];
      if (typeof v === 'number' && v >= 0 && v <= MAX_UPGRADE_LEVEL) s.upgrades[id] = Math.floor(v);
    }
  }
  if (typeof r.best === 'object' && r.best !== null) {
    const b = r.best as Record<string, unknown>;
    for (const st of STAGES) {
      const v = b[st.id];
      if (typeof v === 'number' && isFinite(v) && v >= 0) s.best[st.id] = v;
    }
  }
  return s;
}

export function loadSave(): SaveData {
  if (typeof window === 'undefined') return structuredClone(DEFAULT_SAVE);
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return structuredClone(DEFAULT_SAVE);
    return sanitize(JSON.parse(raw));
  } catch {
    return structuredClone(DEFAULT_SAVE);
  }
}

export function writeSave(data: SaveData): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // storage full / private mode — gameplay continues without persistence
  }
}
