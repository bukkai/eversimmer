import { clamp } from "../../../shared/numbers";
import { RESTING_BROTH, type Broth } from "../../../shared/types";
import type { MoodTargets } from "../source";
import type { PersonMood } from "./extraction";
import type { Reading as LocalReading } from "./signals";

const MEMORY_HALF_LIFE_MS = 4 * 60_000;
const RATE_HALF_LIFE_MS = 3 * 60_000;
const FORGET_BELOW = 0.01;
const PRIOR_WEIGHT = 1.5;
const REACH = { valence: 1, energy: 1, tension: 0.7, warmth: 0.6, texture: 0.9, strangeness: 0.8 };
const BATCH_TRUST = 2;
const ORDINARY_INTENSITY = 0.2;
const BUSY_RATE = 12;
const QUIET_HALF_LIFE_MS = 3 * 60_000;

type Dimension = keyof typeof REACH;
type Heard = {
  at: number;
  weight: number;
  signal: Partial<Record<Dimension, number>>;
  message?: { id: string; name: string };
};

export class RoomMood {
  private heard: Heard[] = [];
  rest: Omit<Broth, "voices"> = RESTING_BROTH;

  hear(id: string, name: string, reading: LocalReading, at: number) {
    const key = name.toLowerCase();
    const k = 1 + this.heard.filter((h) => h.message?.name === key && at - h.at < MEMORY_HALF_LIFE_MS).length;
    const energy = clamp((reading.intensity - ORDINARY_INTENSITY) * 2.5, -1);
    this.heard.push({
      at,
      weight: Math.sqrt(k) - Math.sqrt(k - 1),
      signal: { valence: reading.sentiment, energy },
      message: { id, name: key },
    });
  }

  hearBatch(moods: PersonMood[], ids: string[], at: number) {
    for (const { name, mood } of moods) {
      const key = name.toLowerCase();
      const covered = this.heard.filter((h) => h.message?.name === key && ids.includes(h.message.id));
      const weight = BATCH_TRUST * covered.reduce((sum, h) => sum + h.weight, 0);
      if (weight > 0) this.heard.push({ at, weight, signal: mood });
    }
  }

  forget(ids: string[]) {
    this.heard = this.heard.filter((h) => !h.message || !ids.includes(h.message.id));
  }

  targets(at: number): MoodTargets {
    const rest = this.rest;
    const sums = { valence: [0, 0], energy: [0, 0], tension: [0, 0], warmth: [0, 0], texture: [0, 0], strangeness: [0, 0] };
    let count = 0;
    let lastMessage = -Infinity;
    this.heard = this.heard.filter((h) => {
      const fade = 2 ** (-(at - h.at) / MEMORY_HALF_LIFE_MS);
      if (fade < FORGET_BELOW) return false;
      for (const [dim, value] of Object.entries(h.signal) as [Dimension, number][]) {
        sums[dim][0] += h.weight * fade * value;
        sums[dim][1] += h.weight * fade;
      }
      if (h.message) {
        count += 2 ** (-(at - h.at) / RATE_HALF_LIFE_MS);
        lastMessage = Math.max(lastMessage, h.at);
      }
      return true;
    });
    const perMinute = count / (RATE_HALF_LIFE_MS / 60_000 / Math.LN2);
    const presence = 2 ** (-(at - lastMessage) / QUIET_HALF_LIFE_MS);
    const target = (dim: Dimension, min: number, max: number) => {
      const [sum, weight] = sums[dim];
      return Math.min(max, Math.max(min, rest[dim] + (presence * REACH[dim] * sum) / (weight + PRIOR_WEIGHT)));
    };
    return {
      valence: target("valence", -1, 1),
      energy: target("energy", 0, 1),
      tension: target("tension", 0, 1),
      warmth: target("warmth", 0, 1),
      texture: target("texture", 0, 1),
      strangeness: target("strangeness", 0, 1),
      density: rest.density + (1 - rest.density) * (1 - Math.exp(-perMinute / BUSY_RATE)),
    };
  }
}
