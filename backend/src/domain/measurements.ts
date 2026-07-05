import type { Measurement } from '@nutrition/types';
import { registerStore, scheduleSave, select, upsert } from './store';
import { withUserLock } from './mutex';
import { DEMO_ANCHOR_DATE } from './sampleData';

let MEASUREMENTS: Measurement[] = [];

function today(): string {
  return DEMO_ANCHOR_DATE;
}

/**
 * US Navy body fat % estimation.
 * Male:   86.01 × log10(waist - neck) − 70.041 × log10(height) + 36.76
 * Female: 163.205 × log10(waist + hips - neck) − 97.684 × log10(height) − 78.387
 * All measurements in cm.
 */
export function estimateNavyBF(opts: {
  waist: number;
  neck: number;
  height: number;
  sex?: 'male' | 'female';
  hips?: number;
}): number | null {
  const { waist, neck, height, sex = 'male', hips } = opts;
  if (height <= 0 || neck <= 0) return null;

  if (sex === 'female') {
    if (!hips || hips <= 0) return null;
    const diff = waist + hips - neck;
    if (diff <= 0) return null;
    const bf = 163.205 * Math.log10(diff) - 97.684 * Math.log10(height) - 78.387;
    return Math.round(Math.max(0, bf) * 10) / 10;
  }

  const diff = waist - neck;
  if (diff <= 0) return null;
  const bf = 86.01 * Math.log10(diff) - 70.041 * Math.log10(height) + 36.76;
  return Math.round(Math.max(0, bf) * 10) / 10;
}

/** Log a new measurement. Overwrites existing entry for the same date. */
export function logMeasurement(input: Partial<Measurement> & {
  waist?: number;
  neck?: number;
  height?: number;
  sex?: 'male' | 'female';
}): Measurement {
  const date = input.date ?? today();
  const { waist = null, neck, height, sex, hips = null } = input;

  let bodyFat = input.bodyFat ?? null;

  // Auto-compute Navy BF% if not provided but inputs available
  if (bodyFat == null && waist != null && neck && height) {
    bodyFat = estimateNavyBF({ waist, neck, height, sex, hips: hips ?? undefined });
  }

  const entry: Measurement = {
    date,
    waist: waist ?? null,
    hips,
    chest: input.chest ?? null,
    armLeft: input.armLeft ?? null,
    armRight: input.armRight ?? null,
    thigh: input.thigh ?? null,
    neck: neck ?? null,
    height: height ?? null,
    bodyFat,
  };

  const idx = MEASUREMENTS.findIndex((m) => m.date === date);
  if (idx >= 0) {
    MEASUREMENTS[idx] = entry;
  } else {
    MEASUREMENTS.push(entry);
    MEASUREMENTS.sort((a, b) => a.date.localeCompare(b.date));
  }

  scheduleSave();
  return entry;
}

export function getMeasurements(): Measurement[] {
  return [...MEASUREMENTS];
}

export function getLatestMeasurement(): Measurement | null {
  return MEASUREMENTS.length > 0 ? MEASUREMENTS[MEASUREMENTS.length - 1] : null;
}

export function clearAllMeasurements(): void {
  MEASUREMENTS = [];
  scheduleSave();
}

export async function getMeasurementsForUser(userId: string): Promise<Measurement[]> {
  const raw = await select('measurements', userId);
  if (!Array.isArray(raw)) return [];
  return raw.filter((m): m is Measurement => m && typeof m === 'object' && typeof m.date === 'string');
}

export async function logMeasurementForUser(input: Partial<Measurement> & { waist?: number; neck?: number; height?: number; sex?: 'male' | 'female' }, userId: string): Promise<Measurement> {
  const realToday = new Date().toISOString().slice(0, 10);
  return withUserLock(userId, async () => {
    const date = input.date ?? realToday;
    const { waist = null, neck, height, sex, hips = null } = input;
    let bodyFat = input.bodyFat ?? null;
    if (bodyFat == null && waist != null && neck && height) {
      bodyFat = estimateNavyBF({ waist, neck, height, sex, hips: hips ?? undefined });
    }
    const entry: Measurement = {
      date,
      waist: waist ?? null,
      hips,
      chest: input.chest ?? null,
      armLeft: input.armLeft ?? null,
      armRight: input.armRight ?? null,
      thigh: input.thigh ?? null,
      neck: neck ?? null,
      height: height ?? null,
      bodyFat,
    };
    const measurements = await getMeasurementsForUser(userId);
    const idx = measurements.findIndex((m) => m.date === date);
    if (idx >= 0) {
      measurements[idx] = entry;
    } else {
      measurements.push(entry);
      measurements.sort((a, b) => a.date.localeCompare(b.date));
    }
    await upsert('measurements', measurements, userId);
    return entry;
  });
}

export async function clearAllMeasurementsForUser(userId: string): Promise<void> {
  await upsert('measurements', [], userId);
}

/** Persist measurements. */
registerStore(
  'measurements',
  (): Measurement[] => [...MEASUREMENTS],
  (data: unknown) => {
    if (!Array.isArray(data)) return;
    MEASUREMENTS = data.filter(
      (m): m is Measurement =>
        m && typeof m === 'object' && typeof m.date === 'string',
    );
  },
);
