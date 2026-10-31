export type TempoSegment = {
  cycle: number;
  at: number;
  cps: number;
};

const MAX_TEMPO_NUDGE = 0.03;
export const TEMPO_GLIDE_PER_MINUTE = 0.03;

export const nudgedCps = (base: number, energy: number) => base * (1 + MAX_TEMPO_NUDGE * (2 * energy - 1));

const segmentAtTime = (tempo: TempoSegment[], ms: number) => {
  let seg = tempo[0];
  for (const s of tempo) if (s.at <= ms) seg = s;
  return seg;
};

const segmentAtCycle = (tempo: TempoSegment[], cycle: number) => {
  let seg = tempo[0];
  for (const s of tempo) if (s.cycle <= cycle) seg = s;
  return seg;
};

export const cycleAt = (tempo: TempoSegment[], ms: number) => {
  const s = segmentAtTime(tempo, ms);
  return s.cycle + ((ms - s.at) / 1000) * s.cps;
};

export const timeAtCycle = (tempo: TempoSegment[], cycle: number) => {
  const s = segmentAtCycle(tempo, cycle);
  return s.at + ((cycle - s.cycle) / s.cps) * 1000;
};

export const cpsAtCycle = (tempo: TempoSegment[], cycle: number) => segmentAtCycle(tempo, cycle).cps;
