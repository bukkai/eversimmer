const STRIKE_WINDOW_MS = 24 * 60 * 60_000;
const STRIKES_TO_MUTE = 2;
const MUTE_MS = 60 * 60_000;

export class Strikes {
  private strikes = new Map<string, number[]>();
  private mutedUntil = new Map<string, number>();

  constructor(private now: () => number) {}

  isMuted(name: string) {
    return (this.mutedUntil.get(name.toLowerCase()) ?? 0) > this.now();
  }

  strike(name: string) {
    const key = name.toLowerCase();
    const t = this.now();
    const recent = [...(this.strikes.get(key) ?? []).filter((at) => t - at < STRIKE_WINDOW_MS), t];
    this.strikes.set(key, recent);
    if (recent.length < STRIKES_TO_MUTE || this.isMuted(key)) return false;
    this.mutedUntil.set(key, t + MUTE_MS);
    return true;
  }
}
