/**
 * Continue-watching local store for the Train tab (v0.7 task #121).
 *
 * Stores the last playback position (in seconds) per training_video.id
 * inside AsyncStorage. Read on the Train list to render the Continue
 * Watching row and to seed the player's start position on resume.
 *
 * Pragmatic format: a single JSON map under one key. We rewrite the
 * whole map on every save — the catalog is small (tens of videos) so
 * this avoids fan-out reads when rendering the list. A throttled
 * setter in the player screen keeps writes infrequent (every few
 * seconds while playing) so AsyncStorage doesn't become a bottleneck.
 *
 * Scoped per kid so siblings sharing a parent login don't collide.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export type TrainingProgress = {
  positionSec: number;
  durationSec: number | null;
  updatedAt: number; // ms epoch
};

export type TrainingProgressMap = Record<string, TrainingProgress>;

const KEY_PREFIX = 'ballpark.trainingProgress.v1.';

function key(kidId: string): string {
  return `${KEY_PREFIX}${kidId}`;
}

export async function readProgress(kidId: string): Promise<TrainingProgressMap> {
  try {
    const raw = await AsyncStorage.getItem(key(kidId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as TrainingProgressMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function writeProgress(
  kidId: string,
  videoId: string,
  positionSec: number,
  durationSec: number | null,
): Promise<void> {
  try {
    const cur = await readProgress(kidId);
    cur[videoId] = {
      positionSec: Math.max(0, Math.floor(positionSec)),
      durationSec: durationSec ?? null,
      updatedAt: Date.now(),
    };
    await AsyncStorage.setItem(key(kidId), JSON.stringify(cur));
  } catch {
    // Best-effort — losing a single position update is fine.
  }
}

export async function clearProgress(kidId: string, videoId: string): Promise<void> {
  try {
    const cur = await readProgress(kidId);
    if (videoId in cur) {
      delete cur[videoId];
      await AsyncStorage.setItem(key(kidId), JSON.stringify(cur));
    }
  } catch {
    // ignore
  }
}
